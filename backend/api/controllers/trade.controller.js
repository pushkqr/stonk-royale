import prisma from "../../config/db.js";
import { cryptoPrices } from "../../state/index.js";

export const executeTrade = async (req, res) => {
  const { userId, roomCode, ticker, type, quantity } = req.body;
  const io = req.app.get("io");

  if (!cryptoPrices[ticker]) {
    return res
      .status(400)
      .json({ error: "Invalid ticker or price unavailable" });
  }

  const currentPrice = cryptoPrices[ticker];
  const qty = parseFloat(quantity);

  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: "Invalid quantity" });
  }

  try {
    // 1. Fetch RoomPlayer
    // We search by the User's id or oauth_id to be robust
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: userId }, { oauth_id: userId }],
      },
    });

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const roomPlayer = await prisma.roomPlayer.findFirst({
      where: {
        user_id: user.id,
        room: { room_code: roomCode, status: "ACTIVE" }, // Must be active to trade
      },
      include: { room: true },
    });

    if (!roomPlayer) {
      return res
        .status(400)
        .json({ error: "Player not found in room or room not active" });
    }

    const totalValue = currentPrice * qty;

    if (type === "BUY") {
      if (roomPlayer.available_cash < totalValue) {
        return res.status(400).json({ error: "Insufficient funds" });
      }

      await prisma.$transaction(async (tx) => {
        // Deduct cash
        await tx.roomPlayer.update({
          where: { id: roomPlayer.id },
          data: { available_cash: { decrement: totalValue } },
        });

        // Upsert holding
        const existingHolding = await tx.holding.findFirst({
          where: { room_player_id: roomPlayer.id, ticker },
        });

        let newAvgPrice = currentPrice;
        if (existingHolding) {
          const totalCost =
            existingHolding.quantity * existingHolding.average_buy_price +
            totalValue;
          const newQty = existingHolding.quantity + qty;
          newAvgPrice = totalCost / newQty;

          await tx.holding.update({
            where: { id: existingHolding.id },
            data: { quantity: newQty, average_buy_price: newAvgPrice },
          });
        } else {
          await tx.holding.create({
            data: {
              room_player_id: roomPlayer.id,
              ticker,
              quantity: qty,
              average_buy_price: newAvgPrice,
            },
          });
        }

        // Log transaction
        await tx.transaction.create({
          data: {
            room_player_id: roomPlayer.id,
            ticker,
            type: "BUY",
            quantity: qty,
            price: currentPrice,
          },
        });
      });
    } else if (type === "SELL") {
      const holding = await prisma.holding.findFirst({
        where: { room_player_id: roomPlayer.id, ticker },
      });

      if (!holding || holding.quantity < qty) {
        return res.status(400).json({ error: "Insufficient holding quantity" });
      }

      await prisma.$transaction(async (tx) => {
        // Add cash
        await tx.roomPlayer.update({
          where: { id: roomPlayer.id },
          data: { available_cash: { increment: totalValue } },
        });

        // Update or delete holding
        if (holding.quantity === qty) {
          await tx.holding.delete({ where: { id: holding.id } });
        } else {
          await tx.holding.update({
            where: { id: holding.id },
            data: { quantity: { decrement: qty } },
          });
        }

        // Log transaction
        await tx.transaction.create({
          data: {
            room_player_id: roomPlayer.id,
            ticker,
            type: "SELL",
            quantity: qty,
            price: currentPrice,
          },
        });
      });
    } else {
      return res.status(400).json({ error: "Invalid trade type" });
    }

    // Broadcast updated player state/leaderboard update to room via socket
    if (io) {
      io.to(roomCode).emit("player_updated", { userId });
    }

    return res.json({
      success: true,
      message: `Successfully executed ${type} for ${qty} ${ticker} at $${currentPrice}`,
    });
  } catch (error) {
    console.error("Trade Error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error during trade" });
  }
};
