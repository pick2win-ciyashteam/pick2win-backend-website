import { Router }       from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  createPointsPayment,
  getMyPoints,
  getMyTransactions,
  getStripeConfig,
} from "./deposite.controller.js";

const router = Router();

// ✅ authenticate add చేయి
router.post("/buy-points",      authenticate, createPointsPayment);
router.get ("/stripe/config",   authenticate, getStripeConfig);
router.get ("/my-points",       authenticate, getMyPoints);
router.get ("/my-transactions", authenticate, getMyTransactions);

export default router;