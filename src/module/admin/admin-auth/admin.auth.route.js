import { Router } from "express";
import { adminAuth, adminLimiter } from "../../../middlewares/adminAuth.middleware.js"
import * as v from "./admin.auth.validation.js";
import * as c from  "./admin.auth.controller.js"
import bcrypt from "bcryptjs";
const router = Router();

/* ── Auth ── */
router.post("/login",                adminLimiter, v.adminLogin,   c.adminLogin);

/* ── Employee Management ── */
router.post("/create-admin",       adminLimiter, adminAuth(["super_admin"]), v.createAdmin,  c.createAdmin);
router.get("/get-admins",           adminLimiter, adminAuth(["super_admin"]),                 c.getAdmins);
router.get("/get-admin-by-id/:id",   adminLimiter, adminAuth(["super_admin"]),                 c.getAdminById);
router.put("/update-admin/:id",    adminLimiter, adminAuth(["super_admin"]), v.updateAdmin,  c.updateAdmin);

router.get("/test-hash", async (req, res) => {
  const hash = await bcrypt.hash("StrongPass123", 12);

  res.json({
    password: "StrongPass123",
    hash
  });
});

export default router;  