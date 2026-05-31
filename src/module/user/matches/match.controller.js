import  db  from  "../../../config/db.js";

import {   getMatchesService } from  "./matches.service.js"



export const getAllMatches = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        m.id,
        m.series_id,

        DATE_FORMAT(
          CONVERT_TZ(m.start_time, '+00:00', '+05:30'),
          '%d-%m-%Y'
        ) AS match_date,

        DATE_FORMAT(
          CONVERT_TZ(m.start_time, '+00:00', '+05:30'),
          '%h:%i %p'
        ) AS match_time,

        DATE_FORMAT(
          CONVERT_TZ(m.start_time, '+00:00', '+05:30'),
          '%d-%m-%Y %h:%i %p'
        ) AS start_time_ist,

        m.status,
        m.created_at,

        ht.id AS home_team_id,
        ht.name AS home_team_name,

        at.id AS away_team_id,
        at.name AS away_team_name

      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id

      WHERE m.status = 'UPCOMING'
      ORDER BY m.start_time ASC
    `);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getMatches = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

  const status = req.params.status

 const validTypes = ["LIVE", "UPCOMING", "INREVIEW", "COMPLETED"];
  
    if (!status || !validTypes.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status query param required. Valid values: ${validTypes.join(", ")}`,
      });
    }

    const data = await getMatchesService(userId, status);

    return res.status(200).json({
      success: true,
      status,
      count: data.length,
      data,
    });

  } catch (error) {
    console.error("getMatches error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch matches",
      error: error.message,
    });
  }
};

 
export const getMatchFullDetails = async (req, res) => {
  try {
    const { id } = req.params;

    /* ── 1. Match ── */
    const [[match]] = await db.execute(
      `SELECT
         id, provider_match_id,
         series_id, seriesname,
         home_team_id, hometeamname,
         away_team_id, awayteamname,
         matchdate, start_time,
         status, is_active,
         lineupavailable, lineup_status
       FROM matches
       WHERE id = ? OR provider_match_id = ?
       LIMIT 1`,
      [id, id]
    );

    if (!match) {
      return res.status(404).json({ success: false, message: "Match not found" });
    }

    /* ── 2. Teams ── */
    const [teams] = await db.execute(
      `SELECT id, name, short_name, logo, provider_team_id
       FROM teams
       WHERE id IN (?, ?)`,
      [match.home_team_id, match.away_team_id]
    );

    const homeTeam = teams.find((t) => Number(t.id) === Number(match.home_team_id)) || null;
    const awayTeam = teams.find((t) => Number(t.id) === Number(match.away_team_id)) || null;

    /* ── 3. Match Players ── */
   const [matchPlayers] = await db.execute(
  `SELECT
     mp.id,
     mp.match_id,
     mp.team_id,
     mp.player_name,
     mp.position,
     mp.is_playing,
     mp.is_substitute,
     mp.provider_player_id,
     mp.logo,
     mp.created_at
   FROM match_players mp
   WHERE mp.match_id = ?
   ORDER BY mp.is_playing DESC, mp.is_substitute DESC`,
  [match.id]
);

    /* ── 4. Split by team ── */
    const homePlayers = matchPlayers.filter(
      (p) => Number(p.team_id) === Number(match.home_team_id)
    );
    const awayPlayers = matchPlayers.filter(
      (p) => Number(p.team_id) === Number(match.away_team_id)
    );

    /* ── 5. Playing XI ── */
    const homePlayingXI = homePlayers.filter((p) => Number(p.is_playing) === 1);
    const awayPlayingXI = awayPlayers.filter((p) => Number(p.is_playing) === 1);

    /* ── 6. Substitutes ── */
    const homeSubs = homePlayers.filter((p) => Number(p.is_substitute) === 1);
    const awaySubs = awayPlayers.filter((p) => Number(p.is_substitute) === 1);

    /* ── 7. Lineup status ── */
    let lineupStatus = match.lineup_status || "not_available";
    if (homePlayingXI.length > 0 || awayPlayingXI.length > 0) {
      lineupStatus = "confirmed";
    } else if (matchPlayers.length > 0) {
      lineupStatus = "announced";
    }

    return res.status(200).json({
      success: true,
      data: {
        match: {
          id:                match.id,
          provider_match_id: match.provider_match_id,
          series_id:         match.series_id,
          seriesname:        match.seriesname,
          matchdate:         match.matchdate,
          start_time:        match.start_time,
          status:            match.status,
          is_active:         match.is_active,
          lineupavailable:   match.lineupavailable,
          lineup_status:     lineupStatus,
        },

        home_team: {
          id:         homeTeam?.id,
          name:       homeTeam?.name,
          short_name: homeTeam?.short_name,
          logo:       homeTeam?.logo,
          playing_xi: homePlayingXI,
          substitutes: homeSubs,
        },

        away_team: {
          id:         awayTeam?.id,
          name:       awayTeam?.name,
          short_name: awayTeam?.short_name,
          logo:       awayTeam?.logo,
          playing_xi: awayPlayingXI,
          substitutes: awaySubs,
        },

        counts: {
          total_players:    matchPlayers.length,
          home_playing_xi:  homePlayingXI.length,
          away_playing_xi:  awayPlayingXI.length,
          home_substitutes: homeSubs.length,
          away_substitutes: awaySubs.length,
        },
      },
    });

  } catch (error) {
    console.error("getMatchFullDetails Error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
