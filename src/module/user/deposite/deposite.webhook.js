import Stripe from "stripe";
import { addCoinsService } from "./deposite.service.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("🔔 Event type:", event.type);

  if (event.type !== "payment_intent.succeeded")
    return res.json({ received: true });

  const paymentIntent = event.data.object;
  console.log("🔔 Metadata:", JSON.stringify(paymentIntent.metadata));

  /* ── ✅ coins_purchase check ── */
  if (paymentIntent.metadata?.type !== "coins_purchase") {
    console.log("⚠️ Not a coins purchase:", paymentIntent.metadata?.type);
    return res.json({ received: true });
  }

  const { userId, plan_id, coins } = paymentIntent.metadata;
  const amount          = paymentIntent.amount / 100;
  const paymentIntentId = paymentIntent.id;

  if (!userId || !plan_id || !coins) {
    console.error("❌ Missing metadata");
    return res.json({ received: true });
  }

  try {
    const result = await addCoinsService(
      userId, plan_id, Number(coins), amount, paymentIntentId
    );
    console.log(`✅ Coins added — userId:${userId} coins:${coins} total:${result.totalCoins}`);
    return res.json({ received: true });

  } catch (err) {
    if (err.message === "Payment already processed") {
      console.log("⚠️ Duplicate ignored:", paymentIntentId);
      return res.json({ received: true });
    }
    console.error(`❌ Coins update failed:`, err.message);
    return res.status(500).json({ error: "Coins update failed" });
  }
};