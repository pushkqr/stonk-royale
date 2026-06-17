import prisma from "../../config/db.js";

const generateRoomCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const createRoom = async (req, res) => {
  const { starting_balance, max_players, duration_minutes } = req.body;

  try {
    let roomCode = generateRoomCode();
    // Ensure room code is unique
    let existingRoom = await prisma.room.findUnique({ where: { room_code: roomCode } });
    while (existingRoom) {
      roomCode = generateRoomCode();
      existingRoom = await prisma.room.findUnique({ where: { room_code: roomCode } });
    }

    const room = await prisma.room.create({
      data: {
        room_code: roomCode,
        starting_balance: starting_balance ? parseFloat(starting_balance) : 100000.0,
        max_players: max_players ? parseInt(max_players) : 20,
        duration_minutes: duration_minutes ? parseInt(duration_minutes) : 60,
      },
    });

    return res.json({ success: true, room });
  } catch (error) {
    console.error("Create Room Error:", error);
    return res.status(500).json({ error: "Failed to create room" });
  }
};

export const joinRoom = async (req, res) => {
  const { userId, roomCode } = req.body;

  if (!userId || !roomCode) {
    return res.status(400).json({ error: "Missing userId or roomCode" });
  }

  try {
    // Resolve user (accepts either the internal DB id or the Firebase oauth_id)
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: userId }, { oauth_id: userId }],
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found. Ensure you authenticate via /api/users/auth first." });
    }

    const room = await prisma.room.findUnique({
      where: { room_code: roomCode.toUpperCase() },
      include: { players: true },
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (room.status !== "WAITING") {
      return res.status(400).json({ error: "Room has already started or is completed" });
    }

    // Check if player is already in the room
    let roomPlayer = room.players.find((p) => p.user_id === user.id);

    if (roomPlayer) {
      // Already joined
      return res.json({ success: true, roomPlayer, message: "Already joined" });
    }

    if (room.players.length >= room.max_players) {
      return res.status(400).json({ error: "Room is full" });
    }

    // Link user to room
    roomPlayer = await prisma.roomPlayer.create({
      data: {
        user_id: user.id,
        room_id: room.id,
        available_cash: room.starting_balance,
      },
    });

    return res.json({ success: true, roomPlayer });
  } catch (error) {
    console.error("Join Room Error:", error);
    return res.status(500).json({ error: "Failed to join room" });
  }
};

export const getRoom = async (req, res) => {
  const { roomCode } = req.params;

  try {
    const room = await prisma.room.findUnique({
      where: { room_code: roomCode.toUpperCase() },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar_url: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    return res.json({ success: true, room });
  } catch (error) {
    console.error("Get Room Error:", error);
    return res.status(500).json({ error: "Failed to fetch room" });
  }
};
