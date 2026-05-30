import db from "../../../config/db.js";



/* ================= TODAY'S LINEUP STATUS ================= */


export const getTodayLineupStatus = async (req, res) => {
  const now = new Date();
  try {
    const [matches] = await db.execute(
      `SELECT
         m.id,
         m.start_time,
         m.status,
         m.lineupavailable,
         COALESCE(ht.short_name, ht.name, 'TBA')  AS home_team,
         COALESCE(awt.short_name, awt.name, 'TBA') AS away_team
       FROM matches m
       LEFT JOIN teams ht  ON m.home_team_id = ht.id
       LEFT JOIN teams awt ON m.away_team_id = awt.id
       WHERE m.is_active        = 1
         AND m.status           IN ('UPCOMING', 'LIVE')
         AND m.lineupavailable  = 1
         AND DATE(m.start_time) = CURDATE()
       ORDER BY m.start_time ASC`
    );

    if (!matches.length)
      return res.json({
        success:          true,
        date:             now.toISOString().slice(0, 10),
        any_lineup_today: false,
        data:             [],
      });

    const data = matches.map((m) => {
      const minsLeft = Math.round((new Date(m.start_time) - now) / (1000 * 60));

      let label;
      if      (m.status === "LIVE") label = "Live Now";
      else if (minsLeft > 60)       label = "Lineups Out";
      else if (minsLeft > 45)       label = "Users Adjusting";
      else if (minsLeft > 30)       label = "Captain Rotations";
      else if (minsLeft > 15)       label = "Deadline Pressure";
      else if (minsLeft > 0)        label = "Chaos Zone";
      else                          label = "Fantasy Lock";

      return {
        match_id:   m.id,
        home_team:  m.home_team,
        away_team:  m.away_team,
        start_time: m.start_time,
        status:     m.status,
        label,
      };
    });

    res.json({
      success:          true,
      date:             now.toISOString().slice(0, 10),
      any_lineup_today: true,
      total_matches:    data.length,
      data,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



















export const getMatchTimeline = async (req, res) => {
  try {
    const { matchId } = req.params;

    const [[match]] = await db.execute(
      `SELECT id, start_time, lineupavailable, status FROM matches WHERE id = ? AND is_active = 1`,
      [matchId]
    );

    if (!match) return res.status(404).json({ success: false, message: "Match not found" });

    const timeline = calculateTimeline(match);

    res.json({ success: true, data: timeline });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── Timeline calculate ── */
const calculateTimeline = (match) => {
  const now       = new Date();
  const kickoff   = new Date(match.start_time);
  const minsLeft  = Math.round((kickoff - now) / (1000 * 60));

  // Match already finished
  if (match.status === "RESULT") {
    return {
      matchId:       match.id,
      status:        "RESULT",
      timelineStage: null,
      minsToKickoff: null,
      kickoff:       kickoff,
      lineupAvailable: Boolean(match.lineupavailable),
    };
  }

  // Lineup not available yet
  if (!match.lineupavailable) {
    return {
      matchId:         match.id,
      status:          match.status,
      timelineStage:   "WAITING_LINEUP",
      label:           "Waiting for lineups",
      minsToKickoff:   minsLeft,
      kickoff:         kickoff,
      lineupAvailable: false,
    };
  }

  // Lineup available — calculate stage
  let stage;
  if      (minsLeft > 60)  stage = { key: "LINEUPS_OUT",      label: "Lineups Out",        mins: "~75 MIN", color: "yellow" };
  else if (minsLeft > 45)  stage = { key: "USERS_ADJUSTING",  label: "Users Adjusting",    mins: "~60 MIN", color: "yellow" };
  else if (minsLeft > 30)  stage = { key: "CAPTAIN_ROTATIONS",label: "Captain Rotations",  mins: "~45 MIN", color: "yellow" };
  else if (minsLeft > 15)  stage = { key: "DEADLINE_PRESSURE",label: "Deadline Pressure",  mins: "~30 MIN", color: "red"    };
  else if (minsLeft > 0)   stage = { key: "CHAOS_ZONE",       label: "Chaos Zone",         mins: "~15 MIN", color: "red"    };
  else                     stage = { key: "FANTASY_LOCK",     label: "Fantasy Lock",       mins: "KICKOFF", color: "red"    };

  return {
    matchId:         match.id,
    status:          match.status,
    timelineStage:   stage.key,
    label:           stage.label,
    minsToKickoff:   minsLeft,
    kickoff:         kickoff,
    lineupAvailable: true,
    color:           stage.color,
  };
};
