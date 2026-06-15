import {Router} from "express";
import {getMatchTimeline,getTodayLineupStatus} from "./lineup.controller.js";
const router = Router();

router.get("/today-lineups", getTodayLineupStatus);

router.get("/timeline/:matchId", getMatchTimeline);



export default router;   