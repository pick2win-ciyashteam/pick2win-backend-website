import Joi from "joi";

/* ── Signup ── */
export const signupSchema = Joi.object({
  fullname:      Joi.string().min(3).max(100).required(),
  email:         Joi.string().email().required(),
  mobile: Joi.string().pattern(/^[0-9]{5,15}$/).required(),
  country:       Joi.string().min(2).max(100).required(),
  date_of_birth: Joi.date().less("now").required(),
  password:      Joi.string().min(6).max(100).required(),
});

/* ── Verify Mobile OTP ── */
export const verifyMobileOtpSchema = Joi.object({
  mobile: Joi.string().pattern(/^[0-9]{5,15}$/).required(),  
  otp:    Joi.string().length(6).required(),
});


/* ── Verify Email OTP ── */
export const verifyEmailOtpSchema = Joi.object({
  email: Joi.string().email().required(),   
  otp:   Joi.string().length(6).required(),
});



/* ── Resend OTP ── */
export const resendOtpSchema = Joi.object({
  mobile: Joi.string().pattern(/^[0-9]{5,15}$/),
  email:  Joi.string().email(),
  type:   Joi.string().valid("mobile", "email").required(),
}).or("mobile", "email");   

/* ── Login ── */
export const loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});


