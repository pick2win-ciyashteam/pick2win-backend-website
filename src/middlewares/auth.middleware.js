import jwt from "jsonwebtoken";
import  db from "../config/db.js";

/* ================= TOKEN ERROR MESSAGES ================= */
const TOKEN_ERRORS = {
  TokenExpiredError: "Session expired, please login again",
  JsonWebTokenError: "Invalid token",
  NotBeforeError:    "Token not yet active",
};

/* ================= AUTHENTICATE ================= */
// export const authenticate = async (req, res, next) => {
//   try {

//     /* ── Extract Token ── */
//     const authHeader = req.headers.authorization;

//     if (!authHeader?.startsWith("Bearer ")) {
//       return res.status(401).json({
//         success: false,
//         message: "Authorization header missing or malformed",
//       });
//     }

//     const token = authHeader.split(" ")[1];

//     /* ── Verify Token ── */
//     let decoded;
//     try {
//       decoded = jwt.verify(token, process.env.JWT_SECRET, {
//         algorithms: ["HS256"],
//       });
//     } catch (err) {
//       const message = TOKEN_ERRORS[err.name] || "Token verification failed";
//       return res.status(401).json({ success: false, message });
//     }

//     /* ── Validate Payload ── */
//     if (!decoded?.id || !decoded?.email) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid token payload",
//       });
//     }

//     /* ── Attach User ── */
//     req.user = decoded;
//     next();

//   } catch (err) {
//     if (process.env.NODE_ENV !== "production")
//       console.error("Authenticate error:", err);
//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing or malformed",
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
      });
    } catch (err) {
      const message = TOKEN_ERRORS[err.name] || "Token verification failed";
      return res.status(401).json({ success: false, message });
    }

    if (!decoded?.id || !decoded?.email) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    // ── Admin token user routes లో use చేస్తే block ──
    if (decoded.type === "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: admin token cannot be used on user routes",
      });
    }

    req.user = decoded;
    next();

  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.error("Authenticate error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 

/* ================= CHECK ACCOUNT STATUS ================= */
export const checkAccountStatus = async (req, res, next) => {
  try {

    const [[user]] = await pool.execute(
      `SELECT account_status FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    /* ── Admin Blocked ── */
    if (user.account_status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact support.",
      });
    }

    /* ── User Deleted Account — wipe all data ── */
    if (user.account_status === "deleted") {
      await deleteAllUserData(req.user.id);
      return res.status(403).json({
        success: false,
        message: "Your account has been deleted and all data removed.",
      });
    }

    next();

  } catch (err) {
    if (process.env.NODE_ENV !== "production")
      console.error("CheckAccountStatus error:", err);
    return res.status(500).json({ success: false, message: "Account check failed" });
  }
};

/* ================= DELETE ALL USER DATA ================= */
const deleteAllUserData = async (userId) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Delete in correct order — child tables first, then parent
    await connection.execute(`DELETE FROM player_stats  WHERE player_id IN (SELECT id FROM players WHERE team_id IN (SELECT id FROM teams WHERE created_by = ?))`, [userId]);
    await connection.execute(`DELETE FROM playing_xi    WHERE player_id IN (SELECT id FROM players WHERE team_id IN (SELECT id FROM teams WHERE created_by = ?))`, [userId]);
    await connection.execute(`DELETE FROM players       WHERE team_id   IN (SELECT id FROM teams WHERE created_by = ?)`, [userId]);
    await connection.execute(`DELETE FROM matches       WHERE team_home_id IN (SELECT id FROM teams WHERE created_by = ?) OR team_away_id IN (SELECT id FROM teams WHERE created_by = ?)`, [userId, userId]);
    await connection.execute(`DELETE FROM teams         WHERE created_by = ?`, [userId]);
    await connection.execute(`DELETE FROM users         WHERE id = ?`,         [userId]);

    await connection.commit();
    console.log(`🗑️ All data deleted for user ${userId}`);

  } catch (err) {
    await connection.rollback();
    console.error("❌ deleteAllUserData failed:", err.message);
    throw err;
  } finally {
    connection.release();
  }
};

/* ================= ROLE GUARDS ================= */
export const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access only" });
  }
  next();
};
