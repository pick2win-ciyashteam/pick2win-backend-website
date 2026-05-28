import Joi from "joi";

export const createAdmin = (req, res, next) => {
  const schema = Joi.object({
    name:     Joi.string().min(3).max(100).required(),
    email:    Joi.string().email().required(),
    password: Joi.string().min(8).max(100).required(),
    role:     Joi.string().valid("super_admin", "manager", "support").required(),
  });

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });
  next();
};

export const updateAdmin = (req, res, next) => {
  const schema = Joi.object({
    role:   Joi.string().valid("super_admin", "manager", "support"),
    status: Joi.string().valid("active", "inactive"),
  }).min(1);

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });
  next();
};

export const adminLogin = (req, res, next) => {
  const schema = Joi.object({
    email:    Joi.string().email().required(),
    password: Joi.string().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });
  next();
};