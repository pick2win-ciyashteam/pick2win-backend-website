
import { Router } from "express";
import adminRoutes from "../module/admin/admin.routes.js";
import userRoutes from "../module/user/user.routes.js";


const router = Router();

router.use("/admin", adminRoutes);
router.use("/user", userRoutes);

  
export default router;
