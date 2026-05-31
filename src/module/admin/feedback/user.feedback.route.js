import { Router }       from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { submitFeedback, getMyFeedbacks } from "./feedback.controller.js";

const router = Router();

router.post("/",    authenticate, submitFeedback);

// optional
router.get ("/my",  authenticate, getMyFeedbacks);

export default router;