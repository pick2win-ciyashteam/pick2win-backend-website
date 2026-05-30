import db from "../../../config/db.js";

/* ================= ADD COINS SERVICE ================= */
export const addCoinsService = async (userId, planId, coins, amount, paymentIntentId) => {

  if (!userId || !planId || !coins || !amount)
    throw new Error("Invalid parameters");

  const safePaymentIntentId = typeof paymentIntentId === "string"
    ? paymentIntentId.trim().slice(0, 200)
    : null;

  if (!safePaymentIntentId)
    throw new Error("Invalid payment reference");

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    /* ── 1. Duplicate check ── */
    const [[existing]] = await conn.query(
      `SELECT id FROM coins_transactions WHERE reference_id = ? LIMIT 1`,
      [safePaymentIntentId]
    );
    if (existing) throw new Error("Payment already processed");

    /* ── 2. Plan verify ── */
    const [[plan]] = await conn.query(
      `SELECT id, coins, price, name FROM subscription_plans WHERE id = ? LIMIT 1`,
      [planId]
    );
    if (!plan) throw new Error("Plan not found");

    /* ── 3. User verify ── */
    const [[user]] = await conn.query(
      `SELECT id FROM users WHERE id = ?`, [userId]
    );
    if (!user) throw new Error("User not found");

    /* ── 4. Current coins ── */
    const [[wallet]] = await conn.query(
      `SELECT coins FROM user_coins WHERE user_id = ? FOR UPDATE`,
      [userId]
    );

    const openingCoins = wallet ? Number(wallet.coins) : 0;
    const closingCoins = openingCoins + Number(coins);

    /* ── 5. Coins update or insert ── */
    if (wallet) {
      await conn.query(
        `UPDATE user_coins SET coins = coins + ? WHERE user_id = ?`,
        [coins, userId]
      );
    } else {
      await conn.query(
        `INSERT INTO user_coins (user_id, coins) VALUES (?, ?)`,
        [userId, coins]
      );
    }

    /* ── 6. Transaction log ── */
    await conn.query(
      `INSERT INTO coins_transactions
         (user_id, plan_id, coins, amount,
          opening_points, closing_points,
          reference_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'success')`,
      [userId, planId, coins, amount, openingCoins, closingCoins, safePaymentIntentId]
    );

    await conn.commit();

    return {
      success:        true,
      addedCoins:     Number(coins),
      availableCoins: closingCoins,
    };

  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error(`[addCoinsService] error: ${err.message}`);
    throw err;
  } finally {
    conn.release();
  }
};

/* ================= SPEND COINS SERVICE ================= */
export const spendCoinsService = async (userId, coinsToSpend, description) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[wallet]] = await conn.query(
      `SELECT coins FROM user_coins WHERE user_id = ? FOR UPDATE`,
      [userId]
    );

    if (!wallet || Number(wallet.coins) < coinsToSpend)
      throw new Error("Insufficient coins");

    const openingCoins = Number(wallet.coins);
    const closingCoins = openingCoins - coinsToSpend;

    await conn.query(
      `UPDATE user_coins SET coins = coins - ? WHERE user_id = ?`,
      [coinsToSpend, userId]
    );

    await conn.query(
      `INSERT INTO coins_transactions
         (user_id, coins, amount, opening_points, closing_points, status)
       VALUES (?, ?, 0, ?, ?, 'success')`,
      [userId, -coinsToSpend, openingCoins, closingCoins]
    );

    await conn.commit();
    return { success: true, remainingCoins: closingCoins };

  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
};