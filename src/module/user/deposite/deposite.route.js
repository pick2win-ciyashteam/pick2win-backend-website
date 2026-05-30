import { Router }       from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  createCoinsPayment,
  getMyCoins,
  getMyTransactions,
  getStripeConfig,  
} from "./deposite.controller.js";

const router = Router();    

router.post("/buy-coins",      authenticate, createCoinsPayment);

router.get ("/stripe/config",   authenticate, getStripeConfig);

router.get ("/my-coins",       authenticate, getMyCoins);

router.get ("/my-transactions", authenticate, getMyTransactions);

export default router;