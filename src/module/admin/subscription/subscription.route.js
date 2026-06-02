import { Router }                  from "express";
import { adminLimiter, adminAuth } from "../../../middlewares/adminAuth.middleware.js";
import * as c                      from "./subscription.controller.js";
import * as v                      from "./subscription.validation.js";

const router = Router();

router.post  ("/",           adminLimiter, adminAuth(["super_admin"]), v.addPlan,    c.addPlan);
router.get   ("/",           adminLimiter, adminAuth(["super_admin"]),               c.getAllPlans);
router.get   ("/:id",        adminLimiter, adminAuth(["super_admin"]),               c.getPlanById);
router.patch ("/:id",        adminLimiter, adminAuth(["super_admin"]), v.updatePlan, c.updatePlan);
router.delete("/:id",        adminLimiter, adminAuth(["super_admin"]),               c.deletePlan);
router.patch ("/:id/toggle", adminLimiter, adminAuth(["super_admin"]),               c.togglePlan);

export default router;