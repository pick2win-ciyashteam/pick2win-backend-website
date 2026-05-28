import { Router } from "express";
import { adminAuth }      from "../../middlewares/adminAuth.middleware.js";
import adminAuthRoutes       from "./admin-auth/admin.auth.route.js"
import sportmonksRoutes      from "./sportmonks/sportmonks.router.js";

const router = Router();

router.use("/admin-auth", adminAuthRoutes);
router.use("/sportmonks", adminAuth(), sportmonksRoutes);

export default router;