 import db from "../../../config/db.js";

export const buySubscriptionService = async (
  userId,
  planId,
  paymentReference
) => {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    /* Duplicate payment check */
    const [[existing]] = await conn.query(
      `SELECT id
       FROM subscription_transactions
       WHERE reference_id = ?
       LIMIT 1`,
      [paymentReference]
    );

    if (existing) {
      throw new Error("Subscription already purchased");
    }

    /* Plan */
    const [[plan]] = await conn.query(
      `SELECT *
       FROM subscription_plans
       WHERE id = ?
       AND is_active = 1`,
      [planId]
    );

    if (!plan) {
      throw new Error("Plan not found");
    }

    const startDate = new Date();

    const expiryDate = new Date();
    expiryDate.setDate(
      expiryDate.getDate() + Number(plan.validity_days)
    );

    /* Create subscription */
    const [subResult] = await conn.query(
      `INSERT INTO user_subscriptions
      (
        user_id,
        plan_id,
        plan_name,
        coins,
        matches_allowed,
        amount,
        start_date,
        expiry_date,
        payment_reference,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        userId,
        plan.id,
        plan.name,
        plan.coins,
        plan.matches,
        plan.price,
        startDate,
        expiryDate,
        paymentReference,
      ]
    );

    /* Transaction */
    await conn.query(
      `INSERT INTO subscription_transactions
      (
        user_id,
        plan_id,
        amount,
        reference_id,
        status
      )
      VALUES (?, ?, ?, ?, 'success')`,
      [
        userId,
        plan.id,
        plan.price,
        paymentReference,
      ]
    );

    await conn.commit();

    return {
      success: true,
      subscriptionId: subResult.insertId,
      planName: plan.name,
      coins: plan.coins,
      matches: plan.matches,
      expiryDate,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};


export const getMySubscriptionService = async (userId) => {
  const [[subscription]] = await db.query(
    `SELECT
        us.id,
        us.plan_id,
        us.plan_name,
        us.coins,
        us.matches_allowed,
        us.matches_used,
        (us.matches_allowed - us.matches_used) AS matches_remaining,
        us.amount,
        us.start_date,
        us.expiry_date,
        us.status,
        us.created_at
     FROM user_subscriptions us
     WHERE us.user_id = ?
       AND us.status = 'active'
     ORDER BY us.id DESC
     LIMIT 1`,
    [userId]
  );

  return subscription || null;
};