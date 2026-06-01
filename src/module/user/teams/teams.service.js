// teams service
// import db from "../../../config/db.js"

// export const generateTeamsService = async (userId, matchId, teamA, teamB) => {

//   const conn = await db.getConnection();

//   try {

//     // ── 1. All preflight DB checks in parallel ──
//     const allPlayerIds = [...teamA, ...teamB].map(p => Number(p.Player));
//     if (!allPlayerIds.length) throw new Error("No players provided");

//     const [[matchRows], [logRows], [validPlayers]] = await Promise.all([
//       conn.query(
//         `SELECT status, start_time FROM matches WHERE id = ? LIMIT 1`,
//         [matchId]
//       ),
//       conn.query(
//         `SELECT id FROM match_generation_log WHERE match_id = ? AND user_id = ? LIMIT 1`,
//         [matchId, userId]
//       ),
//       conn.query(
//         `SELECT id FROM players WHERE id IN (?) LIMIT ?`,
//         [allPlayerIds, allPlayerIds.length + 1]
//       ),
//     ]);

//     // ── 2. Validate ──
//     const match = matchRows[0];
//     if (!match) throw new Error("Match not found");
//     if (
//       match.status?.trim().toLowerCase() !== "upcoming" ||
//       new Date() >= new Date(match.start_time)
//     ) throw new Error("Team generation is closed for this match");

//     if (logRows[0]) throw new Error("Teams already generated for this match");

//     if (validPlayers.length !== allPlayerIds.length) {
//       const validSet = new Set(validPlayers.map(r => r.id));
//       const invalid = allPlayerIds.filter(id => !validSet.has(id));
//       throw new Error(`Players do not belong to this match: ${invalid.join(", ")}`);
//     }

//     // ── 3. KEY CHANGE: Run binary AND fetch existing teams in parallel ──
//     //    The binary is the slowest part — hide the DB fetch inside its wait time
//     const [rawOutput, [existingTeams]] = await Promise.all([
//       runBinary(teamA, teamB),
//       conn.query(
//         `SELECT id FROM user_teams WHERE user_id = ? AND match_id = ?`,
//         [userId, matchId]
//       ),
//     ]);

//     // ── 4. Process binary output ──
//     const grouped = groupByTeam(rawOutput);
//     const teamsToSave = Object.entries(grouped).slice(0, 20);
//     if (!teamsToSave.length) throw new Error("Binary generated no teams");

//     const teamMeta = teamsToSave.map(([, members]) => {
//       const captain       = members.find(p => p.Cap === "C");
//       const vice          = members.find(p => p.Cap === "VC");
//       const captainId     = captain?.Player    ? Number(captain.Player)    : null;
//       const viceCaptainId = vice?.Player       ? Number(vice.Player)       : null;
//       const playerIds     = members.map(p => Number(p.Player));
//       const signature     =
//         [...playerIds].sort((a, b) => a - b).join(",") +
//         `|C${captainId}|VC${viceCaptainId}`;
//       return { members, captainId, viceCaptainId, signature };
//     });

//     // ── 5. Short transaction — writes only, no reads inside ──
//     await conn.beginTransaction();

//     // Delete old teams if any (we already fetched them above)
//     if (existingTeams.length) {
//       const ids = existingTeams.map(t => t.id);
//       await Promise.all([
//         conn.query(`DELETE FROM user_team_players WHERE user_team_id IN (?)`, [ids]),
//         conn.query(`DELETE FROM user_teams WHERE id IN (?)`, [ids]),
//       ]);
//     }

//     // Bulk insert user_teams
//     const [insertResult] = await conn.query(
//       `INSERT INTO user_teams (user_id, match_id, team_name, team_signature, locked) VALUES ?`,
//       [teamMeta.map((m, i) => [userId, matchId, `Team ${i + 1}`, m.signature, 0])]
//     );

//     const firstInsertId = insertResult.insertId;

//     // Build player rows
//     const playerRows = [];
//     teamMeta.forEach(({ members, captainId, viceCaptainId }, i) => {
//       const teamId = firstInsertId + i;
//       for (const p of members) {
//         const pid = Number(p.Player);
//         playerRows.push([
//           teamId, pid, p.Role,
//           pid === captainId     ? 1 : 0,
//           pid === viceCaptainId ? 1 : 0,
//         ]);
//       }
//     });

//     // KEY CHANGE: Run both inserts in parallel — they touch different tables
//     await Promise.all([
//       conn.query(
//         `INSERT INTO user_team_players
//          (user_team_id, player_id, role, is_captain, is_vice_captain) VALUES ?`,
//         [playerRows]
//       ),
//       conn.query(
//         `INSERT INTO match_generation_log (match_id, user_id, total_teams) VALUES (?, ?, ?)`,
//         [matchId, userId, teamMeta.length]
//       ),
//     ]);

//     await conn.commit();

//     // ── 6. Fire-and-forget percentage update ──
//     updatePlayerPercentages(allPlayerIds, matchId).catch(err =>
//       console.error("[updatePlayerPercentages]", err)
//     );

//     logActivity({
//       userId,
//       type:        "contest",
//       sub_type:    "teams_generated",
//       title:       "Teams Generated",
//       description: `${teamMeta.length} teams generated for Match #${matchId}`,
//       icon:        "team",
//       meta:        { matchId, totalTeams: teamMeta.length },
//     });

//     return {
//       success:    true,
//       message:    "Teams generated successfully",
//       totalSaved: teamMeta.length,
//     };

//   } catch (err) {
//     await conn.rollback().catch(() => {});
//     throw err;
//   } finally {
//     conn.release();
//   }
// };


// export const getMyTeamsWithPlayersService = async (userId, matchId, contestId) => {

//   const [matchRows] = await db.query(
//     `SELECT id, lineup_status, lineupavailable, is_active, status
//      FROM matches 
//      WHERE id = ?`,
//     [matchId]
//   );

//   const matchData = matchRows.length
//     ? {
//         matchId:         matchRows[0].id,
//         lineupStatus:    matchRows[0].lineup_status,
//         lineupAvailable: matchRows[0].lineupavailable,
//         isActive:        matchRows[0].is_active,
//         status:          matchRows[0].status,
//       }
//     : null;

//   const matchStatus = matchData?.status?.toUpperCase();
//   const isLive      = matchStatus === "LIVE";
//   const isResult    = matchStatus === "RESULT";
//   const applyPoints = isLive || isResult;

//   const contestJoin = contestId
//     ? `LEFT JOIN contest_entries ce ON ce.user_team_id = ut.id AND ce.contest_id = ?`
//     : "";

//   const contestWhere = contestId
//     ? `AND ce.user_team_id IS NULL`
//     : "";

//   const params = [];
//   if (contestId) params.push(contestId);
//   params.push(userId);
//   if (matchId) params.push(matchId);

//   const [rows] = await db.query(
//     `SELECT 
//         ut.id AS team_id,
//         ut.team_name,
//         ut.match_id,

//         p.id AS player_id,
//         p.name,
//         p.position,
//         p.playercredits AS credits,
//         p.player_type,
//         p.playerimage,
//         p.team_id AS real_team_id,

//         t.name AS real_team_name,
//         t.short_name AS real_team_short_name,

//         utp.is_captain,
//         utp.is_vice_captain,
//         utp.is_substitude,

//         COALESCE(pms.fantasy_points, 0) AS base_points,

//         CASE 
//           WHEN mp.player_id IS NOT NULL THEN 1 
//           ELSE 0 
//         END AS is_in_match

//      FROM user_teams ut
//      ${contestJoin}
//      JOIN user_team_players utp ON ut.id = utp.user_team_id
//      JOIN players p ON utp.player_id = p.id
//      LEFT JOIN teams t ON p.team_id = t.id
//      LEFT JOIN match_players mp 
//         ON mp.player_id = p.id 
//         AND mp.match_id = ut.match_id
//      LEFT JOIN player_match_stats pms
//         ON pms.player_id = p.id
//         AND pms.match_id = ut.match_id

//      WHERE ut.user_id = ?
//      ${matchId ? "AND ut.match_id = ?" : ""}
//      ${contestWhere}

//      ORDER BY ut.created_at DESC`,
//     params
//   );

//   if (!rows.length) return [];

//   const teams = {};

//   for (const row of rows) {
//     if (!teams[row.team_id]) {
//       teams[row.team_id] = {
//         teamId:             row.team_id,
//         teamName:           row.team_name,
//         matchId:            row.match_id,
//         match:              matchData,
//         captain:            null,
//         viceCaptain:        null,
//         players:            [],
//         totalPlayers:       0,
//         totalPoints:        0,
//         totalCredits:       0,
//         creditsLeft:        100,
//         realTeamsBreakdown: {},
//         playersNotInMatch:  0
//       };
//     }

//     const basePoints = parseFloat(row.base_points) || 0;

//     // ── LIVE: no captain multiplier ──
//     // ── RESULT: captain/VC multiplier ──
    
//     const player = {
//       playerId:           row.player_id,
//       name:               row.name,
//       position:           row.position,
//       basePoints,
//       effectivePoints:    basePoints, 
//       highestScorerBonus: 0,
//       credits:            parseFloat(row.credits) || 0,
//       playerType:         row.player_type,
//       image:              row.playerimage,
//       isCaptain:          row.is_captain      === 1,
//       isViceCaptain:      row.is_vice_captain === 1,
//       isSubstitute:       row.is_substitude   === 1,
//       realTeamId:         row.real_team_id,
//       realTeamName:       row.real_team_name,
//       realTeamShortName:  row.real_team_short_name,
//       isInMatch:          row.is_in_match     === 1
//     };

//     if (player.isCaptain)     teams[row.team_id].captain     = player;
//     if (player.isViceCaptain) teams[row.team_id].viceCaptain = player;

//     teams[row.team_id].players.push(player);
//     teams[row.team_id].totalPlayers++;
//     teams[row.team_id].totalCredits += player.credits;

//     if (!player.isInMatch) teams[row.team_id].playersNotInMatch++;

//     const rtId = row.real_team_id;
//     if (rtId) {
//       if (!teams[row.team_id].realTeamsBreakdown[rtId]) {
//         teams[row.team_id].realTeamsBreakdown[rtId] = {
//           teamId:    rtId,
//           teamName:  row.real_team_name,
//           shortName: row.real_team_short_name,
//           count:     0
//         };
//       }
//       teams[row.team_id].realTeamsBreakdown[rtId].count++;
//     }
//   }

//   for (const team of Object.values(teams)) {
//     team.realTeamsBreakdown = Object.values(team.realTeamsBreakdown);
//     team.totalCredits = parseFloat(team.totalCredits.toFixed(2));
//     team.creditsLeft  = parseFloat((100 - team.totalCredits).toFixed(2));

//     if (!applyPoints) {
//       // UPCOMING — points 0
//       team.totalPoints = 0;
//       team.players = team.players.map(p => ({
//         ...p, basePoints: 0, effectivePoints: 0, highestScorerBonus: 0
//       }));
//     } else {
//       // ── Step 8: HS Bonus — LIVE + RESULT  ──
//       const maxBase = Math.max(...team.players.map(p => p.basePoints));

//       if (maxBase > 0) {
//         team.players = team.players.map(p => {
//           if (p.basePoints !== maxBase) return p;
//           const hsBonus  = p.isSubstitute ? 8 : 4;
//           const newBase  = p.basePoints + hsBonus;
//           return {
//             ...p,
//             basePoints:         newBase,
//             effectivePoints:    newBase, 
//             highestScorerBonus: hsBonus,
//           };
//         });
//       }

     

//       // ── Step 9: Captain/VC multiplier — LIVE + RESULT ──
// if (isLive || isResult) {  // ✅ both apply చేయి
//     team.players = team.players.map(p => {
//         const multiplier   = p.isCaptain ? 2 : p.isViceCaptain ? 1.5 : 1;
//         const effectivePts = parseFloat((p.basePoints * multiplier).toFixed(2));
//         return { ...p, effectivePoints: effectivePts };
//     });
// }

//       // ── Total points ──
//       team.totalPoints = parseFloat(
//         team.players.reduce((sum, p) => sum + p.effectivePoints, 0).toFixed(2)
//       );

//       // ── Captain/VC reference update ──
//       team.captain     = team.players.find(p => p.isCaptain)     || team.captain;
//       team.viceCaptain = team.players.find(p => p.isViceCaptain) || team.viceCaptain;
//     }

//     if (!team.captain && team.players.length) {
//       team.captain = team.players[0];
//     }
//     if (!team.viceCaptain) {
//       team.viceCaptain = team.players.find(p => !p.isCaptain) || team.players[1];
//     }
//   }

//   return Object.values(teams);
// };


