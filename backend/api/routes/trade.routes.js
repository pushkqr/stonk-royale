import express from "express";
import { executeTrade } from "../controllers/trade.controller.js";

const router = express.Router();

router.post("/", executeTrade);

export default router;
