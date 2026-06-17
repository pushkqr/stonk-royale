import prisma from "../../config/db.js";
import { auth } from "../../config/firebaseAdmin.js";

export const authUser = async (req, res) => {
  const { idToken, username, avatar_url } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: "Missing idToken" });
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    const finalUsername = username || decodedToken.name || "Anonymous";
    const finalAvatar = avatar_url || decodedToken.picture || null;

    const user = await prisma.user.upsert({
      where: { oauth_id: uid },
      update: {
        username: finalUsername,
        avatar_url: finalAvatar,
      },
      create: {
        oauth_id: uid,
        username: finalUsername,
        avatar_url: finalAvatar,
      },
    });

    return res.json({ success: true, user });
  } catch (error) {
    console.error("Auth Error:", error);
    return res.status(401).json({ error: "Invalid token or authentication failed" });
  }
};
