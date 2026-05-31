import db from "../../../config/db.js";

import axios from "axios";

// export const generateTeams = async (req, res) => {
//   try {
//     const userId = req.user.id; 
//     const { match_id, team_a, team_b } = req.body;

//     if (!match_id || !team_a || !team_b) {
//       return res.status(400).json({
//         success: false,
//         message: "match_id, team_a, team_b required",
//       });
//     }

//     if (!Array.isArray(team_a) || !Array.isArray(team_b)) {
//       return res.status(400).json({
//         success: false,
//         message: "team_a and team_b must be arrays",
//       });
//     }

//     const rows = [];

//     for (const player of team_a) {
//       rows.push([
//         match_id,
//         "team_a",
//         player.name,
//         player.role,
//         player.mandate || null,
//         player.captain || null,
//       ]);
//     }

//     for (const player of team_b) {
//       rows.push([
//         match_id,
//         "team_b",
//         player.name,
//         player.role,
//         player.mandate || null,
//         player.captain || null,
//       ]);
//     }  

//     await db.query(
//       `INSERT INTO user_teams
//        (match_id, team_side, name, role, mandate, captain)
//        VALUES ?`,
//       [rows]
//     );

//      // ── match_generation_log insert ──
//     await db.execute(
//       `INSERT INTO match_generation_log (match_id, user_id, total_teams)
//        VALUES (?, ?, ?)
//        ON DUPLICATE KEY UPDATE
//          total_teams = VALUES(total_teams),
//          created_at  = NOW()`,
//       [match_id, userId, 1]
//     );

//     // Send to UCT API
//     try {
//       const response = await axios.post(
//         `${process.env.UCT_API}/football/teams`,
//         {
//           match_id,
//           team_a,
//           team_b,
//         }
//       );

//       console.log("UCT API Response:", response.data);
//     } catch (apiError) {
//       console.error(
//         "UCT API Error:",
//         apiError.response?.data || apiError.message
//       );
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Teams created successfully",
//       total_players: rows.length,
//     });
//   } catch (err) {
//     return res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };


 

export const generateTeams = async (req, res) => {
  try {
    const userId   = req.user.id;
    const { match_id, team_a, team_b } = req.body;

    /* ── 1. Validate ── */
    if (!match_id || !team_a || !team_b) {
      return res.status(400).json({
        success: false,
        message: "match_id, team_a, team_b required",
      });
    }

    if (!Array.isArray(team_a) || !Array.isArray(team_b)) {
      return res.status(400).json({
        success: false,
        message: "team_a and team_b must be arrays",
      });
    }

    /* ── 2. Check already generated ── */
    const [[existing]] = await db.execute(
      `SELECT id FROM match_generation_log
       WHERE match_id = ? AND user_id = ?`,
      [match_id, userId]
    );
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Teams already generated for this match",
      });
    }

    /* ── 3. Check coins ── */
    const [[wallet]] = await db.execute(
      `SELECT available_coins FROM user_coins WHERE user_id = ?`,
      [userId]
    );

    if (!wallet || Number(wallet.available_coins) < 1) {
      return res.status(400).json({
        success: false,
        message: "Insufficient coins. Please buy coins to generate teams.",
      });
    }

    /* ── 4. Call UCT API — same format as they expect ── */
    let uctTeams = [];
    try {
      const response = await axios.post(
        `${process.env.UCT_API}/football/teams`,
        { team_a, team_b },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        }
      );

      uctTeams = response.data || [];
      console.log(`✅ UCT API — ${uctTeams.length} player entries across 20 teams`);

    } catch (apiError) {
      console.error("❌ UCT API Error:", apiError.response?.data || apiError.message);
      return res.status(500).json({
        success: false,
        message: "UCT API failed: " + (apiError.message),
      });
    }

    if (!uctTeams.length) {
      return res.status(400).json({
        success: false,
        message: "UCT API returned no teams",
      });
    }

    /* ── 5. Build name map — coded name → real player info ── */
    // team_a players map
    const nameMap = {};

    // Build from team_a
    const aCounters = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const p of team_a) {
      aCounters[p.role] = (aCounters[p.role] || 0) + 1;
      const codedName = `${p.role[0]}${aCounters[p.role]}_A`;
      // GK→GK1_A, DEF→D1_A, MID→M1_A, FWD→F1_A
      const prefix = p.role === "GK" ? "GK" :
                     p.role === "DEF" ? "D" :
                     p.role === "MID" ? "M" : "F";
      const key = `${prefix}${aCounters[p.role]}_A`;
      nameMap[key] = p.name;
    }

    // Build from team_b
    const bCounters = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const p of team_b) {
      bCounters[p.role] = (bCounters[p.role] || 0) + 1;
      const prefix = p.role === "GK" ? "GK" :
                     p.role === "DEF" ? "D" :
                     p.role === "MID" ? "M" : "F";
      const key = `${prefix}${bCounters[p.role]}_B`;
      nameMap[key] = p.name;
    }

    console.log("📋 Name map:", nameMap);

    /* ── 6. Transaction — deduct coin + store teams ── */
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      /* ── Deduct 1 coin ── */
      const [[currentWallet]] = await conn.query(
        `SELECT available_coins, used_coins, total_coins
         FROM user_coins WHERE user_id = ? FOR UPDATE`,
        [userId]
      );

      if (!currentWallet || Number(currentWallet.available_coins) < 1) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({
          success: false,
          message: "Insufficient coins",
        });
      }

      await conn.query(
        `UPDATE user_coins
         SET available_coins = available_coins - 1,
             used_coins      = used_coins + 1
         WHERE user_id = ?`,
        [userId]
      );

      /* ── Coin transaction log ── */
      await conn.query(
        `INSERT INTO coins_transactions
           (user_id, coins, amount, transaction_type,
            opening_points, closing_points, description, status)
         VALUES (?, -1, 0, 'spent', ?, ?, ?, 'success')`,
        [
          userId,
          Number(currentWallet.available_coins),
          Number(currentWallet.available_coins) - 1,
          `Team generation — match ${match_id}`,
        ]
      );

      /* ── Delete old teams ── */
      await conn.query(
        `DELETE FROM user_teams WHERE match_id = ? AND user_id = ?`,
        [match_id, userId]
      );

      /* ── Store 20 teams ── */
      for (const player of uctTeams) {
        const realName = nameMap[player.name] || player.name;
        await conn.query(
          `INSERT INTO user_teams
             (match_id, user_id, dt_no, name, role, cap, original_name)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            match_id,
            userId,
            player.dt_no,
            player.name,          // coded name GK_A, D1_A etc
            player.role,
            player.cap  || null,
            realName,             // real player name
          ]
        );
      }

      /* ── Generation log ── */
      const totalTeams = [...new Set(uctTeams.map(p => p.dt_no))].length;

      await conn.query(
        `INSERT INTO match_generation_log
           (match_id, user_id, total_teams)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           total_teams = VALUES(total_teams),
           created_at  = NOW()`,
        [match_id, userId, totalTeams]
      );

      await conn.commit();

      return res.status(200).json({
        success:       true,
        message:       `${totalTeams} teams generated successfully`,
        total_teams:   totalTeams,
        coins_used:    1,
        coins_remaining: Number(currentWallet.available_coins) - 1,
      });

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error("generateTeams error:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
 

export const getMyTeams = async (req, res) => {
  try {
    const { matchId } = req.params;

    if (!matchId) {
      return res.status(400).json({
        success: false,
        message: "matchId is required",
      });
    }

    const [teams] = await db.execute(
      `
      SELECT
        id,
        match_id,
        team_side,
        name,
        role,
        mandate,
        captain,
        created_at
      FROM user_teams
      WHERE match_id = ?
      ORDER BY team_side, role, name
      `,
      [matchId]
    );

    const teamA = teams.filter(
      (player) => player.team_side === "team_a"
    );

    const teamB = teams.filter(
      (player) => player.team_side === "team_b"
    );

    return res.status(200).json({
      success: true,
      match_id: Number(matchId),

      team_a_count: teamA.length,
      team_b_count: teamB.length,
      total_players: teams.length,

      captain_count:
        teams.filter((p) => p.captain === "C").length,

      vice_captain_count:
        teams.filter((p) => p.captain === "VC").length,

      team_a: teamA,
      team_b: teamB,
    });
  } catch (error) {
    console.error("getMyTeams Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




/* ================= GET MY GENERATED MATCHES ================= */
 
export const getMyGeneratedMatches = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const [rows] = await db.execute(
      `SELECT
         mgl.match_id,
         mgl.total_teams,
         mgl.created_at  AS generated_at,
         m.start_time,
         m.status,
         s.name          AS series_name,
         COALESCE(ht.short_name,  ht.name,  'TBA') AS home_team,
         COALESCE(awt.short_name, awt.name, 'TBA') AS away_team,
         ht.logo   AS home_logo,
         awt.logo  AS away_logo
       FROM match_generation_log mgl
       JOIN matches m   ON m.id   = mgl.match_id
       LEFT JOIN series s   ON CAST(s.seriesid AS UNSIGNED) = m.series_id
       LEFT JOIN teams ht   ON ht.id  = m.home_team_id
       LEFT JOIN teams awt  ON awt.id = m.away_team_id
       WHERE mgl.user_id = ?
       ORDER BY mgl.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      total:   rows.length,
      data:    rows.map((r) => ({
        match_id:        r.match_id,
        series_name:     r.series_name,
        home_team:       r.home_team,
        away_team:       r.away_team,
        home_logo:       r.home_logo,
        away_logo:       r.away_logo,
        start_time:      r.start_time,
        status:          r.status,
        teams_generated: r.total_teams,
        generated_at:    r.generated_at,
      })),
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ================= GET MY 20 TEAMS ================= */
export const getMyGeneratedTeams = async (req, res) => {
  try {
    const userId      = req.user.id;
    const { matchId } = req.params;

    const [teams] = await db.execute(
      `SELECT
         ut.id          AS team_id,
         ut.team_name,
         ut.created_at,
         COUNT(utp.id)  AS total_players,
         SUM(utp.is_captain)      AS has_captain,
         SUM(utp.is_vice_captain) AS has_vc
       FROM user_teams ut
       LEFT JOIN user_team_players utp ON utp.user_team_id = ut.id
       WHERE ut.user_id  = ?
         AND ut.match_id = ?
       GROUP BY ut.id
       ORDER BY ut.id ASC`,
      [userId, matchId]
    );

    if (!teams.length)
      return res.json({ success: true, total: 0, data: [] });

    res.json({
      success: true,
      total:   teams.length,
      data:    teams.map((t) => ({
        team_id:       t.team_id,
        team_name:     t.team_name,
        total_players: t.total_players,
        created_at:    t.created_at,
      })),
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ================= GET TEAM PLAYERS BY TEAM ID ================= */
//  export const getTeamPlayers = async (req, res) => {
//   try {
//     const { matchId, teamSide } = req.params; // team_a or team_b

//     // Latest generation only — MAX created_at
//     const [[latest]] = await db.execute(
//       `SELECT MAX(created_at) AS latest_at
//        FROM user_teams
//        WHERE match_id = ?`,
//       [matchId]
//     );

//     const [players] = await db.execute(
//       `SELECT id, name, role, mandate, captain, team_side
//        FROM user_teams
//        WHERE match_id   = ?
//          AND team_side  = ?
//          AND created_at = ?
//        ORDER BY FIELD(role, 'GK', 'DEF', 'MID', 'FWD')`,
//       [matchId, teamSide, latest.latest_at]
//     );

//     res.json({
//       success:    true,
//       match_id:   Number(matchId),
//       team_side:  teamSide,
//       total:      players.length,
//       captain:    players.find((p) => p.captain === "C")  || null,
//       vc:         players.find((p) => p.captain === "VC") || null,
//       players,
//     });

//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };


export const getTeamPlayers = async (req, res) => {
  try {
    const userId          = req.user.id;
    const { teamId }      = req.params;

    const [[team]] = await db.execute(
  `SELECT id, name AS team_name, match_id, team_side, created_at
   FROM user_teams
   WHERE id = ?
   LIMIT 1`,
  [teamId]
);

    if (!team)
      return res.status(404).json({ success: false, message: "Team not found" });

    const latestAt = team.created_at;

    const [players] = await db.execute(
      `SELECT id, name, role, mandate, captain, team_side
       FROM user_teams
       WHERE match_id  = ?
         AND team_side = ?
         AND created_at = (
           SELECT MAX(created_at) FROM user_teams
           WHERE match_id = ? AND team_side = ?
         )
       ORDER BY FIELD(role, 'GK', 'DEF', 'MID', 'FWD')`,
      [team.match_id, team.team_side, team.match_id, team.team_side]
    );

    res.json({
      success:   true,
      team_id:   team.id,
      team_name: team.team_name,
      match_id:  team.match_id,
      team_side: team.team_side,
      total:     players.length,
      captain:   players.find((p) => p.captain === "C")  || null,
      vc:        players.find((p) => p.captain === "VC") || null,
      players,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};    