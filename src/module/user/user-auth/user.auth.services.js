  import crypto   from "crypto";
  import bcrypt   from "bcryptjs";
  import jwt      from "jsonwebtoken";
  import  db  from  "../../../config/db.js";

  /* ================= SIGNUP — Send Mobile OTP ================= */
export const signupService = async (data) => {
  const { fullname, email, mobile, country, date_of_birth, password } = data;

  const normalizedMobile = String(mobile).replace(/\D/g, "").trim();

  /* ── 1. Age Checkhk ── */
  const age = new Date(Date.now() - new Date(date_of_birth)).getUTCFullYear() - 1970;
  if (age < 18) throw new Error("You must be at least 18 years old");

  /* ── 2. Duplicate Check —  */
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

  /* ── 4. Generate Mobile OTP ── */
  const mobileOtp    = crypto.randomInt(100000, 999999).toString();
  const mobileExpiry = new Date(Date.now() + 5 * 60 * 1000);

  /* ── 5. Insert User (unverified) ── */
  await db.execute(
    `INSERT INTO users
       (fullname, country, date_of_birth, mobile, email, password,
        mobile_otp, mobile_otp_expiry,
        email_verify, mobile_verify, account_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'active')`,
    [
      fullname, country, date_of_birth,
      normalizedMobile, email, hashedPassword,
      mobileOtp, mobileExpiry,
    ]
  );

  return {
    success: true,
    message: "OTP sent to your mobile. Please verify to complete registration.",
    ...(process.env.NODE_ENV !== "production" && { mobileOtp }),
  };
};

/* ================= VERIFY SIGNUP MOBILE OTP ================= */
export const verifySignupOtpService = async ({ mobile, mobile_otp }) => {
  const normalizedMobile = String(mobile).replace(/\D/g, "").trim();

  /* ── 1. Fetch User ── */
  const [[user]] = await db.execute(
    `SELECT id, email, mobile_otp, mobile_otp_expiry
     FROM users
     WHERE mobile = ? AND mobile_verify = 0`,
    [normalizedMobile]
  );

  if (!user) throw new Error("User not found or already verified");

  /* ── 2. Validate OTP ── */
  if (!user.mobile_otp)                                         throw new Error("OTP expired. Please signup again.");
  if (String(user.mobile_otp) !== String(mobile_otp))           throw new Error("Invalid OTP");
  if (new Date(user.mobile_otp_expiry) < new Date())            throw new Error("OTP expired. Please signup again.");

  /* ── 3. Generate Email Verification Token ── */
  const emailToken       = crypto.randomBytes(32).toString("hex");
  const emailTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hrs

  /* ── 4. Mark Mobile Verified + Store Email Token ── */
  await db.execute(
    `UPDATE users
     SET mobile_verify      = 1,
         mobile_otp         = NULL,
         mobile_otp_expiry  = NULL,
         email_token        = ?,
         email_token_expiry = ?
     WHERE id = ?`,
    [emailToken, emailTokenExpiry, user.id]
  );

  /* ── 5. Send Verification Email (background) ── */
  const verifyLink = `${process.env.BACKEND_URL}/api/auth/verify-email?token=${emailToken}`;

  setImmediate(async () => {
    try {
      // await sendVerificationEmail(user.email, verifyLink);
      console.log(`📧 Verification link: ${verifyLink}`);
    } catch (err) {
      console.error("❌ Email send failed:", err.message);
    }
  });

  return {
    success: true,
    message: "Mobile verified. A verification link has been sent to your email.",
    ...(process.env.NODE_ENV !== "production" && { verifyLink }),
  };
};

/* ================= VERIFY EMAIL LINK ================= */
export const verifyEmailService = async (token) => {

  /* ── 1. Find User by Token ── */
  const [[user]] = await db.execute(
    `SELECT id, email_token_expiry
     FROM users
     WHERE email_token = ? AND email_verify = 0`,
    [token]
  );

  if (!user) throw new Error("Invalid or already used verification link");

  /* ── 2. Check Expiry ── */
  if (new Date(user.email_token_expiry) < new Date()) {
    throw new Error("Verification link expired. Please request a new one.");
  }

  /* ── 3. Mark Email Verified ── */
  await db.execute(
    `UPDATE users
     SET email_verify        = 1,
         email_token         = NULL,
         email_token_expiry  = NULL
     WHERE id = ?`,
    [user.id]
  );

  return {
    success: true,
    message: "Email verified successfully. You can now login.",
  };
};    

/* ================= LOGIN — Email + Password ================= */
export const loginService = async ({ email, password }) => {

  /* ── 1. Fetch User ── */
  const [[user]] = await db.execute(
    `SELECT id, fullname, email, mobile, password,
            account_status, email_verify, mobile_verify
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  if (!user) throw new Error("Invalid email or password");

  /* ── 2. Account Checks ── */
  if (user.account_status === "deleted") throw new Error("This account has been deleted");
  if (user.account_status === "blocked") throw new Error("Your account has been blocked. Contact support.");
  if (user.mobile_verify !== 1)          throw new Error("Please verify your mobile number first");
  if (user.email_verify  !== 1)          throw new Error("Please verify your email first");

  /* ── 3. Password Check ── */
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("Invalid email or password");

  /* ── 4. Update Last Login ── */
  await db.execute(
    `UPDATE users SET updated_at = NOW() WHERE id = ?`,
    [user.id]
  );

  /* ── 5. Generate JWT ── */
  const token = jwt.sign(
    { id: user.id, email: user.email },
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

/* ================= STEP 1 — Request Contact Change ================= */
export const requestContactChangeService = async (userId, { type }) => {

  /* ── 1. Fetch Current User ── */
  const [[user]] = await db.execute(
    `SELECT id, email, mobile FROM users WHERE id = ?`,
    [userId]
  );

  if (!user) throw new Error("User not found");

  /* ── 2. Generate OTP for OLD contact ── */
  const otp    = crypto.randomInt(100000, 999999).toString();
  const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

  /* ── 3. Save OTP + change type ── */
  await db.execute(
    `UPDATE users
     SET contact_change_type    = ?,
         old_contact_otp        = ?,
         old_contact_otp_expiry = ?,
         pending_email          = NULL,
         pending_mobile         = NULL,
         new_contact_otp        = NULL,
         new_contact_otp_expiry = NULL
     WHERE id = ?`,
    [type, otp, expiry, userId]
  );

  /* ── 4. Send OTP to CURRENT contact ── */
  if (type === "email") {
    // await sendOtpEmail(user.email, otp);
    console.log(`📧 Old email OTP to ${user.email}: ${otp}`);
  } else {
    // await sendSms(user.mobile, `Your OTP is ${otp}`);
    console.log(`📱 Old mobile OTP to ${user.mobile}: ${otp}`);
  }

  return {
    success: true,
    message: `OTP sent to your current ${type}. Please verify.`,
    ...(process.env.NODE_ENV !== "production" && { otp }),
  };
};

/* ================= STEP 2 — Verify OLD Contact OTP ================= */
export const verifyOldContactService = async (userId, { otp }) => {

  /* ── 1. Fetch User ── */
  const [[user]] = await db.execute(
    `SELECT id, contact_change_type,
            old_contact_otp, old_contact_otp_expiry
     FROM users WHERE id = ?`,
    [userId]
  );

  if (!user)                        throw new Error("User not found");
  if (!user.contact_change_type)    throw new Error("No contact change request found");
  if (!user.old_contact_otp)        throw new Error("OTP expired. Please request again.");
  if (String(user.old_contact_otp) !== String(otp))
                                    throw new Error("Invalid OTP");
  if (new Date(user.old_contact_otp_expiry) < new Date())
                                    throw new Error("OTP expired. Please request again.");

  /* ── 2. Clear old OTP — mark old verified ── */
  await db.execute(
    `UPDATE users
     SET old_contact_otp         = NULL,
         old_contact_otp_expiry  = NULL
     WHERE id = ?`,
    [userId]
  );

  return {
    success: true,
    message: `Old ${user.contact_change_type} verified. Now enter your new ${user.contact_change_type}.`,
    type: user.contact_change_type,
  };
};

/* ================= STEP 3 — Verify NEW Contact ================= */
export const verifyNewContactService = async (userId, { type, new_value, otp }) => {

  /* ── 1. Fetch User ── */
  const [[user]] = await db.execute(
    `SELECT id, contact_change_type,
            pending_email, pending_mobile,
            new_contact_otp, new_contact_otp_expiry
     FROM users WHERE id = ?`,
    [userId]
  );

  if (!user)                                     throw new Error("User not found");
  if (user.contact_change_type !== type)         throw new Error("Contact change type mismatch");
  if (!user.new_contact_otp && new_value) {
    /* ─ First call: save new contact + send OTP ─ */
    const normalizedValue = type === "mobile"
      ? String(new_value).replace(/\D/g, "").trim()
      : String(new_value).trim().toLowerCase();

    /* ── Check new value not already taken ── */
    const column = type === "email" ? "email" : "mobile";
    const [[taken]] = await db.execute(
      `SELECT id FROM users WHERE ${column} = ? AND id != ?`,
      [normalizedValue, userId]
    );
    if (taken) throw new Error(`This ${type} is already registered to another account`);

    /* ── Generate OTP ── */
    const newOtp    = crypto.randomInt(100000, 999999).toString();
    const newExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    /* ── Save pending contact + OTP ── */
    await db.execute(
      `UPDATE users
       SET pending_email          = ?,
           pending_mobile         = ?,
           new_contact_otp        = ?,
           new_contact_otp_expiry = ?
       WHERE id = ?`,
      [
        type === "email"  ? normalizedValue : null,
        type === "mobile" ? normalizedValue : null,
        newOtp,
        newExpiry,
        userId,
      ]
    );

    /* ── Send OTP to NEW contact ── */
    if (type === "email") {
      // await sendOtpEmail(normalizedValue, newOtp);
      console.log(`📧 New email OTP to ${normalizedValue}: ${newOtp}`);
    } else {
      // await sendSms(normalizedValue, `Your OTP is ${newOtp}`);
      console.log(`📱 New mobile OTP to ${normalizedValue}: ${newOtp}`);
    }

    return {
      success: true,
      message: `OTP sent to your new ${type}. Please verify.`,
      ...(process.env.NODE_ENV !== "production" && { otp: newOtp }),
    };
  }

  /* ─ Second call: verify OTP + update contact ─ */
  if (!user.new_contact_otp)                              throw new Error("OTP expired. Please try again.");
  if (String(user.new_contact_otp) !== String(otp))      throw new Error("Invalid OTP");
  if (new Date(user.new_contact_otp_expiry) < new Date()) throw new Error("OTP expired. Please try again.");

  /* ── Update actual contact ── */
  if (type === "email") {
    await db.execute(
      `UPDATE users
       SET email                 = pending_email,
           email_verify          = 1,
           pending_email         = NULL,
           new_contact_otp       = NULL,
           new_contact_otp_expiry = NULL,
           contact_change_type   = NULL
       WHERE id = ?`,
      [userId]
    );
  } else {
    await db.execute(
      `UPDATE users
       SET mobile                = pending_mobile,
           mobile_verify         = 1,
           pending_mobile        = NULL,
           new_contact_otp       = NULL,
           new_contact_otp_expiry = NULL,
           contact_change_type   = NULL
       WHERE id = ?`,
      [userId]
    );
  }

  return {
    success: true,
    message: `${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully`,
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