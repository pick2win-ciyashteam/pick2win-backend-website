import { Router }      from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  signup,
  verifyMobileOtp,
  verifyEmailOtp,
  resendOtp,
  login,
  logout,
} from  "./user.auth.controllers.js"

const router = Router();

/* ── Public routes ── */
router.post("/signup",             signup);
router.post("/verify-mobile-otp",  verifyMobileOtp);
router.post("/verify-email-otp",   verifyEmailOtp);
router.post("/resend-otp",         resendOtp);
router.post("/login",              login);

/* ── Protected routes ── */
router.post("/logout", authenticate, logout);

export default router;   