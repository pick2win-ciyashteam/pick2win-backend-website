 import db     from "../../../config/db.js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ================= CREATE POINTS PAYMENT ================= */
 export const createPointsPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan_id, amount, coins } = req.body;

    console.log("📦 Creating payment — userId:", userId, "plan_id:", plan_id, "coins:", coins);

    if (!plan_id || !amount || !coins)
      return res.status(400).json({ success: false, message: "plan_id, amount, coins required" });

    const sanitizedAmount = Math.round(Number(amount) * 100) / 100;

    const paymentIntent = await stripe.paymentIntents.create({
  amount:   Math.round(sanitizedAmount * 100),
  currency: "gbp",

  // ❌ remove this
  // automatic_payment_methods: { enabled: true },

  // ✅ add this — card only
  payment_method_types: ["card"],

  metadata: {
    userId:  String(userId),
    plan_id: String(plan_id),
    coins:   String(coins),
    type:    "points_purchase",
  },
});

    // ✅ log చేయి — metadata correctly set అయిందా check చేయి
    console.log("✅ PaymentIntent created:", paymentIntent.id);
    console.log("✅ Metadata:", paymentIntent.metadata);

    res.status(200).json({
      success:      true,
      clientSecret: paymentIntent.client_secret,
    });

  } catch (err) {
    console.error("❌ createPointsPayment error:", err.message);
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

/* ================= GET MY POINTS ================= */
export const getMyPoints = async (req, res) => {
  try {
    const [[points]] = await db.execute(
      `SELECT points FROM user_points WHERE user_id = ?`,
      [req.user.id]
    );

    res.status(200).json({
      success: true,
      points:  points ? Number(points.points) : 0,
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
         pt.id,
         pt.coins,
         pt.amount,
         pt.opening_points,
         pt.closing_points,
         pt.reference_id,
         pt.status,
         pt.created_at,
         sp.name     AS plan_name,
         sp.subtitle AS plan_subtitle
       FROM points_transactions pt
       LEFT JOIN subscription_plans sp ON sp.id = pt.plan_id
       WHERE pt.user_id = ?
       ORDER BY pt.id DESC`,
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