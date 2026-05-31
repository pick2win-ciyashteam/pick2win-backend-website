import { Router } from "express";
import { adminLimiter, adminAuth } from "../../../middlewares/adminAuth.middleware.js";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  getAllFeedbacks, replyFeedback, deleteFeedback,
  updateFeedbackPost, deleteFeedbackPost,
  createFeedbackPost, submitFeedback,
  getMyFeedbacks, getFeedbackPosts,
  getAdminFeedbackPosts,
} from "./feedback.controller.js";   

const router = Router();

// ── USER only (user token required) ──────────────────────────
router.post("/user-post",   authenticate,  submitFeedback);
router.get("/feedback-get", authenticate,  getFeedbackPosts);
router.get("/my",           authenticate,  getMyFeedbacks);

// ── ADMIN only (admin token required) ────────────────────────
router.get   ("/user-feedbacks",      adminLimiter, adminAuth(["super_admin", "admin"]), getAllFeedbacks);
router.post  ("/feedback-post",       adminLimiter, adminAuth(["super_admin", "admin"]), createFeedbackPost);
router.get("/feedback-post", adminLimiter, adminAuth(["super_admin", "admin"]), getAdminFeedbackPosts);
router.patch ("/feedback-post/:id",   adminLimiter, adminAuth(["super_admin", "admin"]), updateFeedbackPost);
router.delete("/feedback-post/:id",   adminLimiter, adminAuth(["super_admin", "admin"]), deleteFeedbackPost);

// optional

router.patch ("/:id",                 adminLimiter, adminAuth(["super_admin", "admin"]), replyFeedback);
router.delete("/:id",                 adminLimiter, adminAuth(["super_admin"]),          deleteFeedback);

export default router;