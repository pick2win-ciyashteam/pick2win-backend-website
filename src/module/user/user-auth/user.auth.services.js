import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt    from "jsonwebtoken";
import db     from "../../../config/db.js";

 
import { sendMail } from "../../../utils/send.mail.js";

const OTP_EXPIRY_MINS = 10;  


/* ================= SIGNUP — store temp + send both OTPs ================= */
export const signupService = async (data) => {
  const { fullname, email, mobile, country, date_of_birth, password } = data;
  const normalizedMobile = String(mobile).replace(/\D/g, "").trim();

  /* ── 1. Age Check ── */
  const age = new Date(Date.now() - new Date(date_of_birth)).getUTCFullYear() - 1970;
  if (age < 18) throw new Error("You must be at least 18 years old");

  /* ── 2. Duplicate Check in users table ── */
  const [[[emailUser]], [[mobileUser]]] = await Promise.all([
    db.execute(`SELECT id, account_status FROM users WHERE email = ?`,  [email]),
    db.execute(`SELECT id, account_status FROM users WHERE mobile = ?`, [normalizedMobile]),
  ]);

  if (emailUser) {
    throw new Error(
      emailUser.account_status === "deleted"
        ? "This email was previously deleted. Contact support."
        : "Email already registered"
    );
  }

  if (mobileUser) {
    throw new Error(
      mobileUser.account_status === "deleted"
        ? "This mobile was previously deleted. Contact support."
        : "Mobile already registered"
    );
  }

  /* ── 3. Hash Password ── */
  const hashedPassword = await bcrypt.hash(password, 10);

  /* ── 4. Generate both OTPs ── */
  const mobileOtp      = crypto.randomInt(100000, 999999).toString();
  const emailOtp       = crypto.randomInt(100000, 999999).toString();
  const otpExpiry      = new Date(Date.now() + 5 * 60 * 1000);  // 5 mins
  const sessionExpiry  = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  /* ── 5. Save to signup_sessions (NOT users table) ── */
  await db.execute(
    `INSERT INTO signup_sessions
       (fullname, email, mobile, country, date_of_birth, password,
        mobile_otp, mobile_otp_expiry,
        email_otp,  email_otp_expiry,
        mobile_verified, email_verified, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
     ON DUPLICATE KEY UPDATE
       mobile_otp         = VALUES(mobile_otp),
       mobile_otp_expiry  = VALUES(mobile_otp_expiry),
       email_otp          = VALUES(email_otp),
       email_otp_expiry   = VALUES(email_otp_expiry),
       mobile_verified    = 0,
       email_verified     = 0,
       expires_at         = VALUES(expires_at)`,
    [
      fullname, email, normalizedMobile, country, date_of_birth, hashedPassword,
      mobileOtp, otpExpiry,
      emailOtp,  otpExpiry,
      sessionExpiry,
    ]
  );

  /* ── 6. Send both OTPs ── */
  // await sendSms(normalizedMobile, `Your OTP is ${mobileOtp}`);
  // await sendEmail(email, `Your OTP is ${emailOtp}`);

  return {
    success: true,
    message: "OTP sent to your mobile and email. Please verify both.",
    ...(process.env.NODE_ENV !== "production" && { mobileOtp, emailOtp }),
  };
};

/* ================= VERIFY MOBILE OTP ================= */
export const verifyMobileOtpService = async ({ mobile, otp }) => {
  const normalizedMobile = String(mobile).replace(/\D/g, "").trim();

  /* ── 1. Fetch session by MOBILE ── */
  const [[session]] = await db.execute(
    `SELECT id, mobile_otp, mobile_otp_expiry,
            mobile_verified, email_verified, expires_at
     FROM signup_sessions
     WHERE mobile = ?`,
    [normalizedMobile]
  );

  if (!session)                                          throw new Error("Session not found. Please signup again.");
  if (new Date(session.expires_at) < new Date())         throw new Error("Session expired. Please signup again.");
  if (session.mobile_verified === 1)                     throw new Error("Mobile already verified.");
  if (!session.mobile_otp)                               throw new Error("OTP expired. Please request again.");
  if (String(session.mobile_otp) !== String(otp))        throw new Error("Invalid OTP");
  if (new Date(session.mobile_otp_expiry) < new Date())  throw new Error("OTP expired. Please request again.");

  /* ── 2. Mark mobile verified ── */
  await db.execute(
    `UPDATE signup_sessions
     SET mobile_verified   = 1,
         mobile_otp        = NULL,
         mobile_otp_expiry = NULL
     WHERE id = ?`,
    [session.id]
  );

  /* ── 3. Check if email also verified ── */
  if (session.email_verified === 1) {
    await completeRegistration(session.id);
    return {
      success:    true,
      message:    "Mobile verified. Registration complete! You can now login.",
      registered: true,
    };
  }

  return {
    success:    true,
    message:    "Mobile verified. Please verify your email OTP too.",
    registered: false,
  };
};

/* ================= VERIFY EMAIL OTP ================= */
export const verifyEmailOtpService = async ({ email, otp }) => {  //  email not mobile

  /* ── 1. Fetch session by EMAIL ── */
  const [[session]] = await db.execute(
    `SELECT id, email_otp, email_otp_expiry,
            mobile_verified, email_verified, expires_at
     FROM signup_sessions
     WHERE email = ?`,                                   // ✅ email not mobile
    [email.trim().toLowerCase()]
  );

  if (!session)                                         throw new Error("Session not found. Please signup again.");
  if (new Date(session.expires_at) < new Date())        throw new Error("Session expired. Please signup again.");
  if (session.email_verified === 1)                     throw new Error("Email already verified.");
  if (!session.email_otp)                               throw new Error("OTP expired. Please request again.");
  if (String(session.email_otp) !== String(otp))        throw new Error("Invalid OTP");
  if (new Date(session.email_otp_expiry) < new Date())  throw new Error("OTP expired. Please request again.");

  /* ── 2. Mark email verified ── */
  await db.execute(
    `UPDATE signup_sessions
     SET email_verified   = 1,
         email_otp        = NULL,
         email_otp_expiry = NULL
     WHERE id = ?`,
    [session.id]
  );

  /* ── 3. Check if mobile also verified ── */
  if (session.mobile_verified === 1) {
    await completeRegistration(session.id);
    return {
      success:    true,
      message:    "Email verified. Registration complete! You can now login.",
      registered: true,
    };
  }

  return {
    success:    true,
    message:    "Email verified. Please verify your mobile OTP too.",
    registered: false,
  };
};
  

/* ================= RESEND OTP ================= */
export const resendOtpService = async ({ mobile, email, type }) => {

  /* ── 1. Find session by mobile OR email ── */
  let session = null;

  if (mobile) {
    const normalizedMobile = String(mobile).replace(/\D/g, "").trim();
    const [[row]] = await db.execute(
      `SELECT id, email, mobile, mobile_verified, email_verified, expires_at
       FROM signup_sessions WHERE mobile = ?`,
      [normalizedMobile]
    );
    session = row;
  } else if (email) {
    const [[row]] = await db.execute(
      `SELECT id, email, mobile, mobile_verified, email_verified, expires_at
       FROM signup_sessions WHERE email = ?`,
      [email.trim().toLowerCase()]
    );
    session = row;
  }

  if (!session)                                  throw new Error("Session not found. Please signup again.");
  if (new Date(session.expires_at) < new Date()) throw new Error("Session expired. Please signup again.");

  /* ── 2. Generate new OTP ── */
  const newOtp    = crypto.randomInt(100000, 999999).toString();
  const newExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

  /* ── 3. Update correct OTP ── */
  if (type === "mobile") {
    if (session.mobile_verified === 1)
      throw new Error("Mobile already verified. No need to resend.");

    await db.execute(
      `UPDATE signup_sessions
       SET mobile_otp = ?, mobile_otp_expiry = ?
       WHERE id = ?`,
      [newOtp, newExpiry, session.id]
    );
    // await sendSms(session.mobile, `Your OTP is ${newOtp}`);

  } else if (type === "email") {
    if (session.email_verified === 1)
      throw new Error("Email already verified. No need to resend.");

    await db.execute(
      `UPDATE signup_sessions
       SET email_otp = ?, email_otp_expiry = ?
       WHERE id = ?`,
      [newOtp, newExpiry, session.id]
    );
    // await sendEmail(session.email, `Your OTP is ${newOtp}`);

  } else {
    throw new Error("type must be 'mobile' or 'email'");
  }

  return {
    success: true,
    message: `OTP resent to your ${type}`,
    ...(process.env.NODE_ENV !== "production" && { otp: newOtp }),
  };
};
/* ================= COMPLETE REGISTRATION — only when BOTH verified ================= */
// const completeRegistration = async (sessionId) => {

//   /* ── 1. Fetch full session data ── */
//   const [[session]] = await db.execute(
//     `SELECT * FROM signup_sessions WHERE id = ?`,
//     [sessionId]
//   );

//   if (!session) throw new Error("Session not found");

//   /* ── 2. Insert into users table ── */
//   await db.execute(
//     `INSERT INTO users
//        (fullname, country, date_of_birth, mobile, email, password,
//         email_verify, mobile_verify, account_status)
//      VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'active')`,
//     [
//       session.fullname,
//       session.country,
//       session.date_of_birth,
//       session.mobile,
//       session.email,
//       session.password,
//     ]
//   );

//   /* ── 3. Delete session — cleanup ── */
//   await db.execute(
//     `DELETE FROM signup_sessions WHERE id = ?`,
//     [sessionId]
//   );
// };


const completeRegistration = async (sessionId) => {
  /* ── 1. Fetch session data ── */
  const [[session]] = await db.execute(
    `SELECT fullname, email, mobile, country, date_of_birth, password
     FROM signup_sessions WHERE id = ?`,
    [sessionId]
  );

  /* ── 2. Insert into users table ── */
  const [result] = await db.execute(
  `INSERT INTO users 
     (fullname, email, mobile, country, date_of_birth, password,
      account_status, email_verify, mobile_verify)
   VALUES (?, ?, ?, ?, ?, ?, 'active', 1, 1)`,
  [session.fullname, session.email, session.mobile,
   session.country, session.date_of_birth, session.password]
);

  const newUserId = result.insertId;

  /* ── 3. Gift welcome coin ── */
  await db.execute(
    `INSERT INTO user_coins
       (user_id, coins, total_coins, used_coins, available_coins, updated_at)
     VALUES (?, 1, 1, 0, 1, NOW())`,
    [newUserId]
  );

  /* ── 4. Clean up session ── */
  await db.execute(`DELETE FROM signup_sessions WHERE id = ?`, [sessionId]);

  return newUserId;
};

/* ================= LOGIN ================= */
export const loginService = async ({ email, password }) => {

  /* ── 1. Fetch User ── */
  const [[user]] = await db.execute(
    `SELECT id, fullname, email, mobile, password,
            account_status, email_verify, mobile_verify
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email.trim().toLowerCase()]
  );

  if (!user) throw new Error("Invalid email or password");

  /* ── 2. Account Status Check ── */
  if (user.account_status === "deleted")
    throw new Error("This account has been deleted. Contact support.");
  if (user.account_status === "blocked")
    throw new Error("Your account has been blocked. Contact support.");

  /* ── 3. Verification Check ── */
  if (user.mobile_verify !== 1)
    throw new Error("Please verify your mobile number first.");
  if (user.email_verify !== 1)
    throw new Error("Please verify your email first.");

  /* ── 4. Password Check ── */
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("Invalid email or password");

  /* ── 5. Update Last Login ── */
  await db.execute(
    `UPDATE users SET updated_at = NOW() WHERE id = ?`,
    [user.id]
  );

  /* ── 6. Generate JWT ── */
  const token = jwt.sign(
    {
      id:    user.id,
      email: user.email,
      type:  "user",
    },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

  return {
    success: true,
    message: "Login successful",
    token,
    user: {
      id:             user.id,
      fullname:       user.fullname,
      email:          user.email,
      mobile:         user.mobile,
      email_verify:   user.email_verify,
      mobile_verify:  user.mobile_verify,
      account_status: user.account_status,
    },
  };
};




/* ================= LOGOUT ================= */
export const logoutService = async (userId) => {
  await db.execute(
    `UPDATE users SET updated_at = NOW() WHERE id = ?`,
    [userId]
  );
  return { success: true, message: "Logged out successfully" };
};




/* ── Generate OTP ── */
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();


 

/* ================= REQUEST MOBILE CHANGE ================= */
export const requestMobileChangeService = async (userId, { new_mobile }) => {
  const normalizedMobile = String(new_mobile).replace(/\D/g, "").trim();

  /* ── 1. Check already registered ── */
  const [[existing]] = await db.execute(
    `SELECT id FROM users WHERE mobile = ? AND id != ?`,
    [normalizedMobile, userId]
  );
  if (existing) throw new Error("This mobile is already registered");

  /* ── 2. Generate OTP ── */
  const otp    = crypto.randomInt(100000, 999999).toString();
  const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

  /* ── 3. Save OTP to users table ── */
  const [result] = await db.execute(
    `UPDATE users
     SET pending_mobile         = ?,
         new_contact_otp        = ?,
         new_contact_otp_expiry = ?,
         contact_change_type    = 'mobile'
     WHERE id = ?`,
    [normalizedMobile, otp, expiry, userId]
  );

  console.log("✅ OTP saved — affectedRows:", result.affectedRows);
  console.log("✅ OTP:", otp, "| mobile:", normalizedMobile);

  // await sendSms(normalizedMobile, `Your OTP is ${otp}`);

  return {
    success: true,
    message: "OTP sent to your new mobile number",
    ...(process.env.NODE_ENV !== "production" && { otp }),
  };
};

/* ================= VERIFY MOBILE CHANGE ================= */
export const verifyMobileChangeService = async (userId, { otp }) => {   

  /* ── 1. Fetch user ── */
  const [[user]] = await db.execute(
    `SELECT new_contact_otp, new_contact_otp_expiry, pending_mobile
     FROM users WHERE id = ?`,
    [userId]
  );

  console.log("🔍 DB OTP:", user?.new_contact_otp, "| Input OTP:", otp);

  if (!user)                                               throw new Error("User not found");
  if (!user.new_contact_otp)                              throw new Error("OTP expired. Request again.");
  if (String(user.new_contact_otp) !== String(otp))       throw new Error("Invalid OTP");
  if (new Date(user.new_contact_otp_expiry) < new Date()) throw new Error("OTP expired. Request again.");

  /* ── 2. Update mobile ── */
  await db.execute(
    `UPDATE users
     SET mobile                 = pending_mobile,
         mobile_verify          = 1,
         pending_mobile         = NULL,
         new_contact_otp        = NULL,
         new_contact_otp_expiry = NULL,
         contact_change_type    = NULL
     WHERE id = ?`,
    [userId]
  );

  return {
    success: true,
    message: "Mobile number updated successfully",
  };
};

 export const requestEmailChangeService = async (userId, newEmail) => {

  /* ── 1. Check email exists ── */
  const [[existing]] = await db.execute(
    `SELECT id FROM users WHERE email = ? AND id != ?`,
    [newEmail, userId]
  );
  if (existing) throw new Error("Email already in use");

  /* ── 2. Generate OTP ── */
  const otp    = crypto.randomInt(100000, 999999).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  /* ── 3. Save to users table directly ── */
  await db.execute(
    `UPDATE users
     SET pending_email          = ?,
         new_contact_otp        = ?,
         new_contact_otp_expiry = ?,
         contact_change_type    = 'email'
     WHERE id = ?`,
    [newEmail, otp, expiry, userId]
  );

  /* ── 4. Send OTP email ── */
  // await sendMail({
  //   to:      newEmail,
  //   subject: "Email Change OTP",
  //   html:    `<p>Your OTP: <b>${otp}</b>. Valid for 10 minutes.</p>`,
  // });

  return {
    success: true,
    message: "OTP sent to your new email address",
    ...(process.env.NODE_ENV !== "production" && { otp }),
  };
};

/* ================= VERIFY EMAIL CHANGE ================= */
export const verifyEmailChangeService = async (userId, otp) => {

  /* ── 1. Fetch user ── */
  const [[user]] = await db.execute(
    `SELECT new_contact_otp, new_contact_otp_expiry, pending_email
     FROM users WHERE id = ?`,
    [userId]
  );

  if (!user)                                               throw new Error("User not found");
  if (!user.new_contact_otp)                              throw new Error("OTP expired. Request again.");
  if (String(user.new_contact_otp) !== String(otp))       throw new Error("Invalid OTP");
  if (new Date(user.new_contact_otp_expiry) < new Date()) throw new Error("OTP expired. Request again.");

  /* ── 2. Update email ── */
  await db.execute(
    `UPDATE users
     SET email                  = pending_email,
         email_verify           = 1,
         pending_email          = NULL,
         new_contact_otp        = NULL,
         new_contact_otp_expiry = NULL,
         contact_change_type    = NULL
     WHERE id = ?`,
    [userId]
  );

  return {
    success: true,
    message: "Email updated successfully",
  };
};


 /* ================= FORGOT PASSWORD ================= */
export const forgotPasswordService = async (email) => {

  /* ── 1. Find user ── */
  const [[user]] = await db.execute(
    `SELECT id, email FROM users
     WHERE email = ? AND account_status != 'deleted'`,
    [email]
  );
  if (!user) throw new Error("No account found with this email");

  /* ── 2. Generate OTP ── */
  const otp    = crypto.randomInt(100000, 999999).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  /* ── 3. Save to users table ── */
  await db.execute(
    `UPDATE users
     SET loginotp        = ?,
         loginotpexpires = ?
     WHERE id = ?`,
    [otp, expiry, user.id]
  );

  /* ── 4. Send OTP email ── */
  // await sendOtpEmail(email, otp);

  return {
    success: true,
    message: "OTP sent to your email",
    ...(process.env.NODE_ENV !== "production" && { otp }),
  };
};

/* ================= RESET PASSWORD ================= */
export const resetPasswordService = async (email, otp, newPassword) => {

  /* ── 1. Find user + verify OTP ── */
  const [[user]] = await db.execute(
    `SELECT id, loginotp, loginotpexpires
     FROM users
     WHERE email = ? AND account_status != 'deleted'`,
    [email]
  );

  if (!user)                                             throw new Error("User not found");
  if (!user.loginotp)                                   throw new Error("OTP expired. Request again.");
  if (String(user.loginotp) !== String(otp))             throw new Error("Invalid OTP");
  if (new Date(user.loginotpexpires) < new Date())       throw new Error("OTP expired. Request again.");

  /* ── 2. Hash new password ── */
  const hashed = await bcrypt.hash(newPassword, 10);

  /* ── 3. Update password + clear OTP ── */
  await db.execute(
    `UPDATE users
     SET password        = ?,
         loginotp        = NULL,
         loginotpexpires = NULL
     WHERE id = ?`,
    [hashed, user.id]
  );

  return {
    success: true,
    message: "Password reset successfully",
  };
};  

 