import db from "../../../config/db.js";

/* ================= GET ALL SERIES ================= */
// export const getAllSeries = async (req, res) => {
//   try {
//     const [seriesRows] = await db.execute(
//       `SELECT id, seriesid, name, 
//               start_date, end_date, created_at,
//               status, is_selected
//        FROM series
//        WHERE status = 'active'         
//        ORDER BY created_at DESC`
//     );

//     if (!seriesRows.length) {
//       return res.status(200).json({ success: true, count: 0, data: [] });
//     }

//     const result = await Promise.all(
//       seriesRows.map(async (series) => {

//      const [matches] = await db.execute(
//   `SELECT
//       m.id,
//       m.provider_match_id,
//       m.series_id,
//       m.start_time,
//       m.status,
//       m.lineupavailable,
//       m.lineup_status,
//       m.is_active,

//       COALESCE(ht.short_name, ht.name, 'TBA') AS home_team_name,
//       COALESCE(awt.short_name, awt.name, 'TBA') AS away_team_name,

//       ht.logo  AS home_team_logo,
//       awt.logo AS away_team_logo

//    FROM matches m

//    LEFT JOIN teams ht
//           ON m.home_team_id = ht.id

//    LEFT JOIN teams awt
//           ON m.away_team_id = awt.id

//    WHERE m.series_id = ?
//      AND m.is_active = 1
//      AND (
//           m.status = 'LIVE'
//           OR (
//                m.status = 'UPCOMING'
//                AND m.start_time >= NOW()
//              )
//          )

//    ORDER BY
//       CASE
//         WHEN m.status = 'LIVE' THEN 1
//         WHEN m.status = 'UPCOMING' THEN 2
//         ELSE 3
//       END,
//       m.start_time ASC`,

//   [Number(series.seriesid)]  
// );

//         return {
//           ...series,  
//           total_matches: matches.length,
//           matches,
//         };
//       })
//     );

//     /* ── Filter series with no upcoming matches ── */
//     const filtered = result.filter((s) => s.total_matches > 0);

//     res.status(200).json({
//       success: true,
//       count: filtered.length,
//       data: filtered,
//     });

//   } catch (error) {
//     console.error("getAllSeries error:", error.message);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };


export const getAllSeries = async (req, res) => {
  try {
    const userId = req.user?.id || null; // logged in user (optional)

    const [seriesRows] = await db.execute(
      `SELECT id, seriesid, name,
              start_date, end_date, created_at,
              status, is_selected
       FROM series
       WHERE status = 'active'
       ORDER BY created_at DESC`
    );

    if (!seriesRows.length) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const result = await Promise.all(
      seriesRows.map(async (series) => {

        const [matches] = await db.execute(
          `SELECT
      m.id,
      m.provider_match_id,
      m.series_id,
      m.start_time,
      m.status,
      m.lineupavailable,
      m.lineup_status,
      m.is_active,

      COALESCE(ht.short_name, ht.name, 'TBA')  AS home_team_name,
      COALESCE(awt.short_name, awt.name, 'TBA') AS away_team_name,

      ht.logo  AS home_team_logo,
      awt.logo AS away_team_logo,

      CASE
        WHEN mgl.id IS NOT NULL THEN 1
        ELSE 0
      END            AS teams_generated,
      mgl.created_at AS generated_at

   FROM matches m
   LEFT JOIN teams ht  ON m.home_team_id = ht.id
   LEFT JOIN teams awt ON m.away_team_id = awt.id
   LEFT JOIN match_generation_log mgl
          ON mgl.match_id = m.id
         AND mgl.user_id  = ?
         AND mgl.status   = 'success'

   WHERE m.series_id = ?
     AND m.is_active = 1
     AND m.status    = 'UPCOMING'
     AND m.start_time >= NOW()

   ORDER BY m.start_time ASC`,

          [userId, Number(series.seriesid)]
        );

        return {
          ...series,
          total_matches: matches.length,
          matches: matches.map((m) => ({
            ...m,
            teams_generated: Boolean(m.teams_generated),

            generated_at: m.generated_at || null,
          })),
        };
      })
    );

    /* ── Filter series with no upcoming/live matches ── */
    const filtered = result.filter((s) => s.total_matches > 0);

    res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered,
    });

  } catch (error) {
    console.error("getAllSeries error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= GET SERIES BY ID ================= */
export const getSeriesById = async (req, res) => {
  try {
    const seriesid = Number(req.params.id);

    if (!req.params.id || isNaN(seriesid)) {
      return res.status(400).json({
        success: false,
        message: "Valid series id is required",
      });
    }

    const [[row]] = await db.execute(
      `SELECT * FROM series WHERE seriesid = ? LIMIT 1`,
      [seriesid]
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Series not found" });
    }

    res.status(200).json({ success: true, data: row });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= GET MATCHES BY SERIES ID ================= */
export const getMatchesBySeriesId = async (req, res) => {
  try {
    const { seriesid } = req.params;

    if (!seriesid) {
      return res.status(400).json({
        success: false,
        message: "Series id is required",
      });
    }

    const [rows] = await db.execute(
      `SELECT
          m.id,
          m.provider_match_id,
          m.series_id,
          m.start_time,
          m.status,
          m.matchdate,
          m.lineupavailable,
          m.lineup_status,
          m.is_active,
          ht.short_name AS home_team_name,
          awt.short_name AS away_team_name,
          ht.logo AS home_team_logo,
          awt.logo AS away_team_logo
       FROM matches m
       JOIN teams ht  ON m.home_team_id = ht.id
       JOIN teams awt ON m.away_team_id = awt.id
       WHERE m.series_id = ?
       ORDER BY m.start_time ASC`,
      [seriesid]
    );

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};