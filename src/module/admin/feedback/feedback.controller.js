import db from "../../../config/db.js";

/* ================= USER — SUBMIT FEEDBACK ================= */
export const submitFeedback = async (req, res) => {
  try {
    const userId          = req.user.id;
    const { type, message } = req.body;

    if (!type || !message)
      return res.status(400).json({ success: false, message: "type and message required" });

    const validTypes = ["uct_tuning", "feature_suggestion", "league_request", "engine_accuracy", "bug_report", "what_you_love"];
    if (!validTypes.includes(type))
      return res.status(400).json({ success: false, message: "Invalid feedback type" });

    if (message.trim().length < 10)
      return res.status(400).json({ success: false, message: "Message too short" });

    await db.execute(
      `INSERT INTO feedbacks (user_id, type, message) VALUES (?, ?, ?)`,
      [userId, type, message.trim()]
    );

    res.status(200).json({ success: true, message: "Feedback submitted successfully" });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createFeedbackPost = async (req, res) => {
  try {
    const { title, message } = req.body;

    await db.execute(
      `INSERT INTO feedbacks
       (user_id, type, message, status)
       VALUES (?, ?, ?, ?)`,
      [null, title, message, "resolved"]
    );

    res.json({
      success: true,
      message: "Announcement created"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};


 export const getFeedbackPosts = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
          id,
          type AS title,
          message,
          created_at
       FROM feedbacks
       WHERE user_id IS NULL
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};


export const updateFeedbackPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message } = req.body;

    await db.execute(
      `UPDATE feedback_posts
       SET title = ?, message = ?
       WHERE id = ?`,
      [title, message, id]
    );

    res.json({
      success: true,
      message: "Post updated successfully"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

export const deleteFeedbackPost = async (req, res) => {
  try {
    const { id } = req.params;

    await db.execute(
      `DELETE FROM feedback_posts
       WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: "Post deleted successfully"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

export const getAllFeedbacks = async (req, res) => {
  try {
    const page  = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const { type, status } = req.query;

    let where = "WHERE 1=1";
    const params = [];

    if (type) {
      where += " AND f.type = ?";
      params.push(type);
    }

    if (status) {
      where += " AND f.status = ?";
      params.push(status);
    }

    const [rows] = await db.execute(
      `SELECT
         f.id,
         f.type,
         f.message,
         f.status,
         f.admin_reply,
         f.created_at,
         u.id AS user_id,
         u.fullname AS user_name,
         u.email AS user_email
       FROM feedbacks f
       JOIN users u ON u.id = f.user_id
       ${where}
       ORDER BY f.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM feedbacks f
       ${where}`,
      params
    );

    res.json({
      success: true,
      total,
      page,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/* ================= ADMIN — REPLY TO FEEDBACK ================= */
export const replyFeedback = async (req, res) => {
  try {
    const { id }                    = req.params;
    const { admin_reply, status }   = req.body;

    if (!admin_reply)
      return res.status(400).json({ success: false, message: "admin_reply required" });

    const validStatus = ["pending", "reviewed", "resolved"];
    const newStatus   = validStatus.includes(status) ? status : "reviewed";

    await db.execute(
      `UPDATE feedbacks SET admin_reply = ?, status = ? WHERE id = ?`,
      [admin_reply.trim(), newStatus, id]
    );

    res.json({ success: true, message: "Reply sent successfully" });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ================= ADMIN — DELETE FEEDBACK ================= */
export const deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;

    await db.execute(`DELETE FROM feedbacks WHERE id = ?`, [id]);

    res.json({ success: true, message: "Feedback deleted" });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



/* ================= USER — MY FEEDBACKS ================= */
export const getMyFeedbacks = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.execute(
      `SELECT id, type, message, status, admin_reply, created_at
       FROM feedbacks
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, total: rows.length, data: rows });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAdminFeedbackPosts = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, type AS title, message, created_at
       FROM feedbacks
       WHERE user_id IS NULL
       ORDER BY created_at DESC`
    );

    res.json({ success: true, data: rows });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};