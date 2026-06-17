import { io as Client } from "socket.io-client";
import prisma from "../config/db.js";

async function runTest() {
  console.log("Setting up historical payload test data...");

  // 1. Get or create user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: { username: "ChartTester", oauth_id: "charttest123" },
    });
  }

  // 2. Create a brand new WAITING room
  const roomCode = "CHART";
  let room = await prisma.room.findUnique({ where: { room_code: roomCode } });
  if (room) {
    // Reset to WAITING if it exists
    await prisma.room.update({
      where: { id: room.id },
      data: { status: "WAITING" },
    });
  } else {
    room = await prisma.room.create({
      data: { room_code: roomCode, status: "WAITING" },
    });
  }

  // 3. Add player to room (and ensure they are NOT ready)
  let player = await prisma.roomPlayer.findFirst({
    where: { user_id: user.id, room_id: room.id },
  });
  if (player) {
    await prisma.roomPlayer.update({
      where: { id: player.id },
      data: { is_ready: false },
    });
  } else {
    await prisma.roomPlayer.create({
      data: {
        user_id: user.id,
        room_id: room.id,
        is_ready: false,
        available_cash: 100000,
      },
    });
  }

  console.log(`Room ${roomCode} created with 1 waiting player.`);
  console.log("Connecting WebSocket...\n");

  const socket = Client("http://localhost:8000");

  socket.on("connect", () => {
    console.log("WebSocket Connected!");

    // Join the socket room
    socket.emit("join_room", { roomCode, userId: user.id });

    // Instantly ready up. Since we are the only player, this triggers game_started!
    console.log("Emitting player_ready...");
    socket.emit("player_ready", { roomCode, userId: user.id });
  });

  socket.on("game_started", (payload) => {
    console.log(`\n🚀 GAME STARTED EVENT RECEIVED! 🚀`);
    console.log(`Start Time: ${payload.startTime}`);
    console.log(`End Time: ${payload.endTime}`);

    console.log(
      `\nHistorical Data Payload Keys:`,
      Object.keys(payload.historicalData),
    );

    // Print a tiny snippet of the BTC chart data
    const btcData = payload.historicalData["BTC"];
    console.log(`\nBTC History length: ${btcData.length} data points.`);
    console.log(`Snippet (first 2 points):`);
    console.log(btcData.slice(0, 2));

    process.exit(0);
  });
}

runTest();
