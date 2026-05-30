import {
  signupService,
  verifyMobileOtpService,
  verifyEmailOtpService,
  resendOtpService,
  loginService,
  logoutService,
} from "./user.auth.services.js"

import db from "../../../config/db.js";

/* ================= SIGNUP ================= */
export const signup = async (req, res) => {
  try {
    const result = await signupService(req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ================= VERIFY MOBILE OTP ================= */
export const verifyMobileOtp = async (req, res) => {
  try {
    const result = await verifyMobileOtpService(req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ================= VERIFY EMAIL OTP ================= */
export const verifyEmailOtp = async (req, res) => {
  try {
    const result = await verifyEmailOtpService(req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ================= RESEND OTP ================= */
export const resendOtp = async (req, res) => {
  try {
    const result = await resendOtpService(req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ================= LOGIN ================= */
export const login = async (req, res) => {
  try {
    const result = await loginService(req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ================= LOGOUT ================= */
export const logout = async (req, res) => {
  try {
    const result = await logoutService(req.user.id);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

 
/* ================= GET PROFILE ================= */
export const getProfile = async (req, res) => {
  try {
    /* ── 1. User + Subscription ── */
    const [[user]] = await db.execute(
      `SELECT
         u.id,
         u.fullname,
         u.email,
         u.mobile,
         u.country,
         u.date_of_birth,
         u.email_verify,
         u.mobile_verify,
         u.account_status,
         u.created_at,

         -- Subscription
         us.plan_id,
         us.plan_name,
         us.matches_allowed,
         us.matches_used,
         (us.matches_allowed - us.matches_used) AS matches_remaining,
         us.amount                               AS subscription_amount,
         us.start_date                           AS subscription_start,
         us.expiry_date                          AS subscription_expiry,
         us.status                               AS subscription_status

       FROM users u
       LEFT JOIN user_subscriptions us
         ON us.user_id = u.id
        AND us.status = 'active'
       WHERE u.id = ?
         AND u.account_status != 'deleted'
       ORDER BY us.id DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    /* ── 2. Coins Wallet ── */
    const [[wallet]] = await db.execute(
      `SELECT coins FROM user_coins WHERE user_id = ?`,
      [req.user.id]
    );

    /* ── 3. Total purchased coins ── */
    const [[purchased]] = await db.execute(
      `SELECT COALESCE(SUM(coins), 0) AS total
       FROM coins_transactions
       WHERE user_id = ? AND coins > 0 AND status = 'success'`,
      [req.user.id]
    );

    /* ── 4. Total spent coins ── */
    const [[spent]] = await db.execute(
      `SELECT COALESCE(SUM(ABS(coins)), 0) AS total
       FROM coins_transactions
       WHERE user_id = ? AND coins < 0 AND status = 'success'`,
      [req.user.id]
    );

    const availableCoins = wallet    ? Number(wallet.coins)      : 0;
    const totalCoins     = purchased ? Number(purchased.total)   : 0;
    const usedCoins      = spent     ? Number(spent.total)       : 0;

    res.status(200).json({
      success: true,
      data: {
        /* ── Personal Info ── */
        id:             user.id,
        fullname:       user.fullname,
        email:          user.email,
        mobile:         user.mobile,
        country:        user.country,
        date_of_birth:  user.date_of_birth,
        email_verify:   user.email_verify,
        mobile_verify:  user.mobile_verify,
        account_status: user.account_status,
        created_at:     user.created_at,

        /* ── Coins Wallet ── */
        coins: {
          total_coins:     totalCoins,
          used_coins:      usedCoins,
          available_coins: availableCoins,
        },

        /* ── Subscription ── */
        subscription: user.plan_id ? {
          plan_id:           user.plan_id,
          plan_name:         user.plan_name,
          matches_allowed:   user.matches_allowed,
          matches_used:      user.matches_used,
          matches_remaining: user.matches_remaining,
          amount:            user.subscription_amount,
          start_date:        user.subscription_start,
          expiry_date:       user.subscription_expiry,
          status:            user.subscription_status,
        } : null,
      },
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ================= UPDATE PROFILE ================= */
export const updateProfile = async (req, res) => {
  try {
    const ALLOWED = ["fullname", "country", "date_of_birth"];
    const sanitized = {};

    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) sanitized[key] = req.body[key];
    }

    if (!Object.keys(sanitized).length) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    /* ── Age check ── */
    if (sanitized.date_of_birth) {
      const age =
        new Date(Date.now() - new Date(sanitized.date_of_birth)).getUTCFullYear() - 1970;
      if (age < 18) {
        return res.status(400).json({
          success: false,
          message: "You must be at least 18 years old",
        });
      }
    }

    const setClauses = Object.keys(sanitized).map((k) => `${k} = ?`).join(", ");
    const setValues  = Object.values(sanitized);

    await db.execute(
      `UPDATE users SET ${setClauses} WHERE id = ?`,
      [...setValues, req.user.id]
    );

    /* ── Return updated profile ── */
    const [[updated]] = await db.execute(
      `SELECT
         id, fullname, email, mobile,
         country, date_of_birth,
         email_verify, mobile_verify,
         account_status, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data:    updated,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ================= DELETE ACCOUNT ================= */
export const deleteAccount = async (req, res) => {
  try {
    await db.execute(
      `UPDATE users SET account_status = 'deleted' WHERE id = ?`,
      [req.user.id]
    );

    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};