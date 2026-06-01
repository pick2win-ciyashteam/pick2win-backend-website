// import * as s from "./countries.service.js";

// /* ── Get all active countries ── */
//  export const getActiveCountries = async (req, res) => {
//   try {
//     const result = await s.getActiveCountriesService();
//     res.status(200).json(result);
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// };

// /* ── Get country by name ── */
//  export const getCountryByName = async (req, res) => {
//   try {
//     const result = await s.getCountryByNameService(req.params.name);
//     res.status(200).json(result);
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// };


// countries.controller.js

import db from "../../../config/db.js";

/* ── Get all active countries ── */
export const getActiveCountries = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT name, code, dial_code, flag 
       FROM countries 
       WHERE is_active = 1 
       ORDER BY name ASC`
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* ── Get country by name ── */
export const getCountryByName = async (req, res) => {
  try {
    const [[country]] = await db.execute(
      `SELECT name, code, dial_code, flag
       FROM countries
       WHERE LOWER(name) = LOWER(?) AND is_active = 1`,
      [req.params.name]
    );

    if (!country) return res.status(404).json({ success: false, message: "Country not found" });

    res.status(200).json({ success: true, data: country });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};