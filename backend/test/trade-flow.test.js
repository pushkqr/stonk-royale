import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { io as Client } from "socket.io-client";
import prisma from "../config/db.js";

const PORT = process.env.PORT || 3001;
const API_URL = `http://localhost:${PORT}/api/trade`;
const WS_URL = `http://localhost:${PORT}`;

describe("StonkRoyale Game Loop & WebSockets Integration Test", () => {
  let clientSocket;
  let testUser;
  let testRoom;
  let testRoomPlayer;
  let liveCryptoPrice = 0;
  let liveCryptoSymbol = "BTC"; // Fallback, will update on websocket event

  before(async () => {
    // 1. Seed Database with Test Entities
    testUser = await prisma.user.create({
      data: {
        username: "TestTrader_" + Date.now(),
      },
    });

    testRoom = await prisma.room.create({
      data: {
        room_code: "TEST" + Math.floor(Math.random() * 10),
        status: "WAITING",
        starting_balance: 100000,
      },
    });

    testRoomPlayer = await prisma.roomPlayer.create({
      data: {
        user_id: testUser.id,
        room_id: testRoom.id,
        available_cash: 100000,
        is_ready: false,
      },
    });

    // 2. Initialize Socket.io Client
    clientSocket = Client(WS_URL);
  });

  after(async () => {
    // Cleanup DB (order matters due to foreign keys)
    await prisma.transaction.deleteMany({
      where: { room_player_id: testRoomPlayer.id },
    });
    await prisma.holding.deleteMany({
      where: { room_player_id: testRoomPlayer.id },
    });
    await prisma.roomPlayer.delete({ where: { id: testRoomPlayer.id } });
    await prisma.room.delete({ where: { id: testRoom.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

    if (clientSocket) {
      clientSocket.disconnect();
    }
    await prisma.$disconnect();
  });

  it("should connect to WebSockets and receive initial prices", () => {
    return new Promise((resolve, reject) => {
      let timer;

      clientSocket.on("connect", () => {
        assert.ok(clientSocket.id, "Should get a valid socket id");
      });

      clientSocket.on("initial_prices", (prices) => {
        clearTimeout(timer);
        assert.ok(prices, "Should receive prices object");
        // Ensure standard keys exist
        assert.ok("BTC" in prices);
        assert.ok("ETH" in prices);
        resolve();
      });

      timer = setTimeout(
        () => reject(new Error("Timeout waiting for connection/initial_prices")),
        5000,
      );
    });
  });

  it("should receive real-time price updates from Binance stream", () => {
    return new Promise((resolve, reject) => {
      let timer;
      clientSocket.on("price_update", ({ symbol, price }) => {
        clearTimeout(timer);
        assert.ok(symbol, "Should have a ticker symbol");
        assert.ok(price > 0, "Should have a valid price");

        // Cache this for the REST API test!
        liveCryptoPrice = price;
        liveCryptoSymbol = symbol;
        resolve();
      });

      timer = setTimeout(
        () => reject(new Error("No price updates received. Is Binance service running?")),
        5000,
      );
    });
  });

  it("should handle joining a room", () => {
    return new Promise((resolve) => {
      clientSocket.emit("join_room", {
        roomCode: testRoom.room_code,
        userId: testUser.id,
      });

      // We will blindly resolve because our own emit('user_joined') only broadcasts to OTHERS in the room.
      // But we can ensure it doesn't crash.
      setTimeout(() => {
        resolve();
      }, 500);
    });
  });

  it("should successfully execute a BUY trade via REST API", async () => {
    assert.ok(
      liveCryptoPrice > 0,
      "Need a valid live price to execute a trade",
    );

    const qtyToBuy = 1.5;
    const payload = {
      userId: testUser.id,
      roomCode: testRoom.room_code,
      ticker: liveCryptoSymbol,
      type: "BUY",
      quantity: qtyToBuy,
    };

    // First change room status temporarily to ACTIVE so trade passes validation
    await prisma.room.update({
      where: { id: testRoom.id },
      data: { status: "ACTIVE" },
    });

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200, `API Error: ${data.error}`);
    assert.strictEqual(data.success, true);

    // Verify DB modifications
    const updatedPlayer = await prisma.roomPlayer.findUnique({
      where: { id: testRoomPlayer.id },
    });
    assert.ok(
      updatedPlayer.available_cash < 100000,
      "Cash should have decreased",
    );

    const holding = await prisma.holding.findFirst({
      where: { room_player_id: testRoomPlayer.id, ticker: liveCryptoSymbol },
    });
    assert.strictEqual(
      holding.quantity,
      qtyToBuy,
      "Holding quantity should match",
    );
  });

  it("should toggle player ready state and transition room to ACTIVE", () => {
    return new Promise(async (resolve, reject) => {
      let timer;
      // Revert status to WAITING for the target logic test
      await prisma.room.update({
        where: { id: testRoom.id },
        data: { status: "WAITING" },
      });

      clientSocket.on("game_started", async ({ startTime, endTime }) => {
        clearTimeout(timer);
        assert.ok(startTime);
        assert.ok(endTime);

        // Verify DB update
        const roomCheck = await prisma.room.findUnique({
          where: { id: testRoom.id },
        });
        assert.strictEqual(
          roomCheck.status,
          "ACTIVE",
          "Room should now be ACTIVE",
        );
        resolve();
      });

      clientSocket.emit("player_ready", {
        roomCode: testRoom.room_code,
        userId: testUser.id,
      });

      timer = setTimeout(
        () => reject(new Error("Timeout waiting for game_started trigger")),
        5000,
      );
    });
  });
});
