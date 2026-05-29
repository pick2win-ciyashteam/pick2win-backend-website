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

         COALESCE(uc.coins, 0) AS coins,

         us.plan_id,
         us.plan_name,
         us.matches_allowed,
         us.matches_used,
         (us.matches_allowed - us.matches_used) AS matches_remaining,
         us.amount AS subscription_amount,
         us.start_date AS subscription_start_date,
         us.expiry_date AS subscription_expiry_date,
         us.status AS subscription_status

       FROM users u

       LEFT JOIN user_coins uc
         ON uc.user_id = u.id

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
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// export const getProfile = async (req, res) => {
//   try {
//     const [[user]] = await db.execute(
//       `SELECT
//          u.id, u.fullname, u.email, u.mobile,
//          u.country, u.date_of_birth,
//          u.email_verify, u.mobile_verify,
//          u.account_status, u.created_at,
//          COALESCE(up.coins, 0) AS coins
//        FROM users u
//        LEFT JOIN user_coins up ON up.user_id = u.id
//        WHERE u.id = ? AND u.account_status != 'deleted'`,
//       [req.user.id]
//     );

//     if (!user) {
//       return res.status(404).json({ success: false, message: "User not found" });
//     }

//     res.status(200).json({ success: true, data: user });

//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

/* ================= UPDATE PROFILE ================= */
export const updateProfile = async (req, res) => {
  try {
    const ALLOWED = ["fullname", "country", "date_of_birth"];
    const sanitized = {};

    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) sanitized[key] = req.body[key];
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

    const [[updated]] = await db.execute(
      `SELECT
         id, fullname, email, mobile,
         country, date_of_birth,
         email_verify, mobile_verify,
         account_status, created_at
       FROM users
       WHERE id = ?`,
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