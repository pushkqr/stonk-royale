import express from "express";
import { executeTrade, getTradeHistory } from "../controllers/trade.controller.js";

const router = express.Router();

router.post("/", executeTrade);
router.get("/history/:roomCode/:userId", getTradeHistory);

export default router;
