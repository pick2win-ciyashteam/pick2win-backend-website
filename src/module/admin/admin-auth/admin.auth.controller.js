import * as s from  "./admin.auth.service.js"

const getIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

/* ================= LOGIN ================= */
export const adminLogin = async (req, res) => {
  try {
    const result = await s.adminLoginService(req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ================= CREATE ADMIN ================= */
export const createAdmin = async (req, res) => {
  try {
    const result = await s.createAdmin(req.body, req.admin, getIp(req));
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ================= GET ALL ADMINS ================= */
export const getAdmins = async (req, res) => {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await s.getAdmins({ page, limit });
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ================= GET ADMIN BY ID ================= */
export const getAdminById = async (req, res) => {
  try {
    const result = await s.getAdminById(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ================= UPDATE ADMIN ================= */
export const updateAdmin = async (req, res) => {
  try {
    const result = await s.updateAdmin(req.params.id, req.body, req.admin, getIp(req));
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};