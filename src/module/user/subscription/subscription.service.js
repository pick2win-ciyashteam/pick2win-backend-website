 import db from "../../../config/db.js";

 

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