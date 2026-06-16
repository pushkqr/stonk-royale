import WebSocket from "ws";
import { cryptoPrices } from "../state/index.js";

const binanceWsUrl =
  "wss://stream.binance.com:9443/ws/btcusdt@miniTicker/ethusdt@miniTicker/solusdt@miniTicker/dogeusdt@miniTicker";
let binanceWs;

export function connectBinance(io) {
  binanceWs = new WebSocket(binanceWsUrl);

  binanceWs.on("open", () => {
    console.log("Connected to Binance WebSocket Stream");
  });

  binanceWs.on("message", (data) => {
    try {
      const payload = JSON.parse(data);
      // Valid payload: { e: "24hrMiniTicker", s: "BTCUSDT", c: "50000.00", ... }
      if (payload.e === "24hrMiniTicker") {
        const symbol = payload.s.replace("USDT", "");

        if (symbol in cryptoPrices) {
          cryptoPrices[symbol] = parseFloat(payload.c);

          // Broadcast to connected clients.
          if (io) {
            io.emit("price_update", { symbol, price: cryptoPrices[symbol] });
          }
        }
      }
    } catch (err) {
      console.error("Error parsing Binance WS message:", err.message);
    }
  });

  binanceWs.on("close", () => {
    console.log("Binance WS disconnected. Reconnecting in 5s...");
    setTimeout(() => connectBinance(io), 5000);
  });

  binanceWs.on("error", (err) => {
    console.error("Binance WS error:", err.message);
  });
}
