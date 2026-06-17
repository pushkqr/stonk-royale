import prisma from "../config/db.js";
import { cryptoPrices } from "../state/index.js";

export function startEndGameService(io) {
  // Run every 10 seconds to check for expired rooms
  setInterval(async () => {
    try {
      const now = new Date();

      // Find all rooms that are ACTIVE and whose end_time has passed
      const expiredRooms = await prisma.room.findMany({
        where: {
          status: "ACTIVE",
          end_time: { lte: now },
        },
        include: {
          players: {
            include: {
              holdings: true,
              user: {
                select: {
                  username: true,
                  avatar_url: true,
                },
              },
            },
          },
        },
      });

      for (const room of expiredRooms) {
        console.log(`Room ${room.room_code} has ended! Liquidating assets...`);

        const finalLeaderboard = [];

        await prisma.$transaction(async (tx) => {
          for (const player of room.players) {
            // 1. Calculate final crypto value based on current live prices
            const cryptoValue = player.holdings.reduce((sum, holding) => {
              const currentPrice = cryptoPrices[holding.ticker] || 0;
              return sum + holding.quantity * currentPrice;
            }, 0);

            const finalNetWorth = player.available_cash + cryptoValue;
            const finalPnl = finalNetWorth - room.starting_balance;

            // 2. Update player's cash to their final net worth
            await tx.roomPlayer.update({
              where: { id: player.id },
              data: { available_cash: finalNetWorth },
            });

            // 3. Delete all holdings (liquidate)
            await tx.holding.deleteMany({
              where: { room_player_id: player.id },
            });

            // 4. Add to final leaderboard
            finalLeaderboard.push({
              userId: player.user_id,
              username: player.user.username,
              avatar_url: player.user.avatar_url,
              netWorth: finalNetWorth,
              pnl: finalPnl,
              availableCash: finalNetWorth,
              cryptoValue: 0, // all liquidated
            });
          }

          // 5. Mark room as COMPLETED
          await tx.room.update({
            where: { id: room.id },
            data: { status: "COMPLETED" },
          });
        });

        // Sort leaderboard to find winner
        finalLeaderboard.sort((a, b) => b.netWorth - a.netWorth);

        // Broadcast game over event
        io.to(room.room_code).emit("game_over", {
          message: "Tournament has ended! Assets have been liquidated.",
          leaderboard: finalLeaderboard,
          winner: finalLeaderboard.length > 0 ? finalLeaderboard[0] : null,
        });
      }
    } catch (error) {
      console.error("EndGame Service Error:", error);
    }
  }, 10000);
}
