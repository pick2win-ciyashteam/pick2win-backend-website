import { Router } from "express";
import { getActivePlans, buySubscription, getMySubscription } from "./subscription.controller.js";
import { authenticate } from "../../../middlewares/auth.middleware.js";

const router = Router();


// admin get plans list
router.get("/", getActivePlans); 

// user buy subscription

router.post("/buy",authenticate, buySubscription);

router.get("/my-subscription", authenticate, getMySubscription);

export default router;