import prisma from "../config/db.js";
import { cryptoPrices } from "../state/index.js";

export function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Send immediate price state upon connection
    socket.emit("initial_prices", cryptoPrices);

    // Join Room
    socket.on("join_room", async ({ roomCode, userId }) => {
      socket.join(roomCode);
      console.log(`User ${userId} joined room ${roomCode}`);

      // Announce to the rest of the room
      socket.to(roomCode).emit("user_joined", { userId });
    });

    // Example Event: Global Chat
    socket.on("chat_message", ({ roomCode, username, text }) => {
      io.to(roomCode).emit("chat_message", {
        username,
        text,
        timestamp: Date.now(),
      });
    });

    // Example Event: Ready Up (for the tournament state machine)
    socket.on("player_ready", async ({ roomCode, userId }) => {
      try {
        const roomPlayer = await prisma.roomPlayer.findFirst({
          where: { user_id: userId, room: { room_code: roomCode } },
        });

        if (roomPlayer) {
          // Update ready status in DB
          await prisma.roomPlayer.update({
            where: { id: roomPlayer.id },
            data: { is_ready: true },
          });

          io.to(roomCode).emit("player_ready_status", {
            userId,
            isReady: true,
          });

          // Check if all players in the room are ready
          const room = await prisma.room.findUnique({
            where: { room_code: roomCode },
            include: { players: true },
          });

          if (room && room.status === "WAITING") {
            const allReady = room.players.every((p) => p.is_ready);
            if (allReady && room.players.length > 0) {
              // Require at least 1 player to start
              // Transition to ACTIVE state
              const now = new Date();
              const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour tournament

              await prisma.room.update({
                where: { id: room.id },
                data: { status: "ACTIVE", start_time: now, end_time: endTime },
              });

              console.log(`Room ${roomCode} has started!`);
              io.to(roomCode).emit("game_started", { startTime: now, endTime });
            }
          }
        }
      } catch (error) {
        console.error("Ready Up Error:", error);
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
