import db from "../../../config/db.js";

/* ================= GET ACTIVE COUNTRIES ================= */

 export const getActiveCountriesService = async (isActive) => {
  let query = `SELECT name, code, dial_code, flag FROM countries`;
  const params = [];

  if (isActive !== undefined) {
    query += ` WHERE is_active = ?`;
    params.push(isActive);
  }

  query += ` ORDER BY name ASC`;

  const [rows] = await db.execute(query, params);

  return {
    success: true,
    data: rows,
  };
};

/* ================= GET COUNTRY BY NAME ================= */

export const getCountryByNameService = async (name) => {
  const [[country]] = await db.execute(
    `SELECT name, code, dial_code, flag
     FROM countries
     WHERE LOWER(name) = LOWER(?) AND is_active = 1`,
    [name]
  );

  if (!country) throw new Error("Country not found");

  return { success: true, data: country };
};