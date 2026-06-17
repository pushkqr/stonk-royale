import { io as Client } from "socket.io-client";
import prisma from "../config/db.js";

async function runTest() {
  console.log("Setting up endgame test data...");

  let user = await prisma.user.findFirst();

  const now = new Date();
  // Set end_time to 5 seconds from now so it expires almost instantly
  const endTime = new Date(now.getTime() + 5 * 1000);

  let room = await prisma.room.findFirst();
  room = await prisma.room.update({
    where: { id: room.id },
    data: { status: "ACTIVE", end_time: endTime },
  });

  let player = await prisma.roomPlayer.findFirst({
    where: { user_id: user.id, room_id: room.id },
  });

  // Give the player a fake holding so we can see it get liquidated
  await prisma.holding.upsert({
    where: {
      room_player_id_ticker: {
        room_player_id: player.id,
        ticker: "ETH",
      },
    },
    update: { quantity: 10, average_buy_price: 3000 },
    create: {
      room_player_id: player.id,
      ticker: "ETH",
      quantity: 10,
      average_buy_price: 3000,
    },
  });

  console.log(
    `Room ${room.room_code} set to ACTIVE. It will expire in 5 seconds.`,
  );
  console.log("Waiting for game_over event...\n");

  const socket = Client("http://localhost:8000");

  socket.on("connect", () => {
    socket.emit("join_room", { roomCode: room.room_code, userId: user.id });
  });

  socket.on("game_over", (data) => {
    console.log(`\n🚨 GAME OVER EVENT RECEIVED 🚨`);
    console.log(data.message);
    console.log("\nFinal Leaderboard:");
    console.table(data.leaderboard);
    console.log("\nWinner:", data.winner?.username);
    process.exit(0);
  });
}

runTest();
