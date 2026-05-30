import { Router }       from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as v           from "./user.auth.validations.js";
import * as c           from "./user.auth.controllers.js";

const router = Router();

/* ── Public routes ── */
router.post("/signup",            v.signup,          c.signup);
router.post("/verify-mobile-otp", v.verifyMobileOtp, c.verifyMobileOtp);
router.post("/verify-email-otp",  v.verifyEmailOtp,  c.verifyEmailOtp);
router.post("/resend-otp",        v.resendOtp,       c.resendOtp);
router.post("/login",             v.login,           c.login);

/* ── Protected routes ── */
router.post  ("/logout",  authenticate,              c.logout); 
router.get   ("/profile", authenticate,              c.getProfile);
router.patch ("/update",  authenticate, v.updateProfile, c.updateProfile);
router.delete("/delete",  authenticate,              c.deleteAccount);

export default router;
  



   




// import { Router }      from "express";
// import { authenticate } from "../../../middlewares/auth.middleware.js";
// import {
//   signup,
//   verifyMobileOtp,
//   verifyEmailOtp,
//   resendOtp,
//   login,
//   logout,
//   updateProfile,
//   deleteAccount,
//   getProfile,
// } from  "./user.auth.controllers.js"

// import * as v           from "./user.auth.validations.js";
// import * as c           from  "./user.auth.controllers.js"

// const router = Router();

// /* ── Public routes ── */
// router.post("/signup",             signup);
// router.post("/verify-mobile-otp",  verifyMobileOtp);
// router.post("/verify-email-otp",   verifyEmailOtp);
// router.post("/resend-otp",         resendOtp);
// router.post("/login",              login);
// router.post("/logout", authenticate, logout);


// /* ── Protected routes ── */
// router.get   ("/profile", authenticate, c.getProfile);
// router.patch ("/update", authenticate, v.updateProfile, c.updateProfile);
// router.delete("/delete", authenticate, c.deleteAccount);


// export default router;   
