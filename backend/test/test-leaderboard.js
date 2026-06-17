import { io as Client } from "socket.io-client";
import prisma from "../config/db.js";

async function runTest() {
  console.log("Setting up test data...");

  // 1. Get or create a user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: { username: "TestTrader", oauth_id: "test1234" },
    });
  }

  // 2. Get or create a room and force it to ACTIVE
  let room = await prisma.room.findFirst();
  if (!room) {
    room = await prisma.room.create({
      data: { room_code: "TEST1", status: "ACTIVE" },
    });
  } else {
    room = await prisma.room.update({
      where: { id: room.id },
      data: { status: "ACTIVE" },
    });
  }

  // 3. Ensure RoomPlayer exists
  let player = await prisma.roomPlayer.findFirst({
    where: { user_id: user.id, room_id: room.id },
  });
  if (!player) {
    player = await prisma.roomPlayer.create({
      data: { user_id: user.id, room_id: room.id, available_cash: 50000 },
    });
  }

  // 4. Add a fake holding to see real-time price fluctuations
  const holding = await prisma.holding.findFirst({
    where: { room_player_id: player.id, ticker: "BTC" },
  });
  if (!holding) {
    await prisma.holding.create({
      data: {
        room_player_id: player.id,
        ticker: "BTC",
        quantity: 1.5,
        average_buy_price: 60000,
      },
    });
  }

  console.log(`\nSetup complete! Room Code is: ${room.room_code}`);
  console.log("Connecting WebSocket to listen for leaderboard updates...\n");

  // 5. Connect WebSocket
  const socket = Client("http://localhost:8000");

  socket.on("connect", () => {
    console.log("WebSocket Connected!");
    socket.emit("join_room", { roomCode: room.room_code, userId: user.id });
  });

  socket.on("leaderboard_update", (data) => {
    console.log(
      `\n[${new Date().toLocaleTimeString()}] 🏆 Leaderboard Update Received:`,
    );
    console.table(data);
  });

  socket.on("disconnect", () => {
    console.log("WebSocket Disconnected.");
  });
}

runTest();
