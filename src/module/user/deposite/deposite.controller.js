import db     from "../../../config/db.js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ================= CREATE COINS PAYMENT ================= */
export const createCoinsPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan_id, amount, coins } = req.body;

    if (!plan_id || !amount || !coins)
      return res.status(400).json({ success: false, message: "plan_id, amount, coins required" });

    const [[plan]] = await db.execute(
      `SELECT id, coins, price FROM subscription_plans WHERE id = ? AND is_active = 1`,
      [plan_id]
    );
    if (!plan)
      return res.status(400).json({ success: false, message: "Invalid plan" });

    const sanitizedAmount = Math.round(Number(amount) * 100) / 100;

    const paymentIntent = await stripe.paymentIntents.create({
      amount:               Math.round(sanitizedAmount * 100),
      currency:             "gbp",
      payment_method_types: ["card"],
      metadata: {
        userId:  String(userId),
        plan_id: String(plan_id),
        coins:   String(coins),
        type:    "coins_purchase",
      },
    });

    console.log("✅ PaymentIntent:", paymentIntent.id);
    console.log("✅ Metadata:", paymentIntent.metadata);

    res.status(200).json({
      success:      true,
      clientSecret: paymentIntent.client_secret,
    });

  } catch (err) {
    console.error("❌ createCoinsPayment:", err.message);
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ================= GET STRIPE CONFIG ================= */
export const getStripeConfig = async (req, res) => {
  try {
    res.status(200).json({
      success:        true,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ================= GET MY COINS ================= */
export const getMyCoins = async (req, res) => {
  try {
    const [[wallet]] = await db.execute(
      `SELECT coins FROM user_coins WHERE user_id = ?`,
      [req.user.id]
    );

    /* ── spent coins calculate చేయి ── */
    const [[spent]] = await db.execute(
      `SELECT COALESCE(SUM(ABS(coins)), 0) AS spent
       FROM coins_transactions
       WHERE user_id = ? AND coins < 0 AND status = 'success'`,
      [req.user.id]
    );

    /* ── total purchased ── */
    const [[purchased]] = await db.execute(
      `SELECT COALESCE(SUM(coins), 0) AS total
       FROM coins_transactions
       WHERE user_id = ? AND coins > 0 AND status = 'success'`,
      [req.user.id]
    );

    const availableCoins = wallet ? Number(wallet.coins) : 0;
    const usedCoins      = spent  ? Number(spent.spent)  : 0;
    const totalCoins     = purchased ? Number(purchased.total) : 0;

    res.status(200).json({
      success: true,
      wallet: {
        total_coins:     totalCoins,
        used_coins:      usedCoins,
        available_coins: availableCoins,
      },
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ================= GET MY TRANSACTIONS ================= */
export const getMyTransactions = async (req, res) => {
  try {
    const [transactions] = await db.execute(
      `SELECT
         ct.id,
         ct.coins,
         ct.amount,
         ct.opening_points  AS opening_coins,
         ct.closing_points  AS closing_coins,
         ct.reference_id,
         ct.status,
         ct.created_at,
         CASE WHEN ct.coins > 0 THEN 'purchase' ELSE 'spent' END AS transaction_type,
         sp.name     AS plan_name,
         sp.subtitle AS plan_subtitle
       FROM coins_transactions ct
       LEFT JOIN subscription_plans sp ON sp.id = ct.plan_id
       WHERE ct.user_id = ?
       ORDER BY ct.id DESC`,
      [req.user.id]
    );

    res.status(200).json({
      success: true,
      total:   transactions.length,
      data:    transactions,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};