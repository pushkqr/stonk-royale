import prisma from "../config/db.js";
import { cryptoPrices } from "../state/index.js";

export function startLeaderboardService(io) {
  // Run every 2 seconds
  setInterval(async () => {
    try {
      // Find all rooms that are currently active
      const activeRooms = await prisma.room.findMany({
        where: { status: "ACTIVE" },
        include: {
          players: {
            include: {
              user: {
                select: {
                  username: true,
                  avatar_url: true,
                },
              },
              holdings: true,
            },
          },
        },
      });

      for (const room of activeRooms) {
        const leaderboard = room.players.map((player) => {
          // Calculate crypto portfolio value based on live prices
          const cryptoValue = player.holdings.reduce((sum, holding) => {
            const currentPrice = cryptoPrices[holding.ticker] || 0;
            return sum + holding.quantity * currentPrice;
          }, 0);

          const netWorth = player.available_cash + cryptoValue;
          const pnl = netWorth - room.starting_balance;

          return {
            userId: player.user_id,
            username: player.user.username,
            avatar_url: player.user.avatar_url,
            netWorth: netWorth,
            pnl: pnl,
            availableCash: player.available_cash,
            cryptoValue: cryptoValue,
          };
        });

        // Sort descending by net worth
        leaderboard.sort((a, b) => b.netWorth - a.netWorth);

        // Broadcast to everyone in this room
        io.to(room.room_code).emit("leaderboard_update", leaderboard);
      }
    } catch (error) {
      console.error("Leaderboard Service Error:", error);
    }
  }, 2000);
}
