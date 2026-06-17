import { Router } from "express";
import { createRoom, joinRoom, getRoom } from "../controllers/room.controller.js";

const router = Router();

router.post("/create", createRoom);
router.post("/join", joinRoom);
router.get("/:roomCode", getRoom);

export default router;
