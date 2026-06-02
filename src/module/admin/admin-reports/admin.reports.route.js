import express from "express";
import {
    getActivityDormancyReport,
    getDashboardReport,
    getDirectoryReport,
    getGeographyReport,
    getLeagueMatches,
    getLiveMatches,
    // getMatchDashboardReport,
    getPackBuyersReport,
    getPastMatches,
    getUpcomingMatches,
    getEnginePerformance,
    getLiveStream,
    getPeakAnalysis,
    getEnginePerformanceReport,
    getCapacityPlanning,
    getMatchHistory
    
} from "./admin.reports.controller.js";


const router = express.Router();

router.get("/overview", getDashboardReport);

router.get("/geography", getGeographyReport);

router.get("/pack-buyers", getPackBuyersReport);

router.get("/activity-dormancy", getActivityDormancyReport);

router.get("/directory", getDirectoryReport);

router.get("/matches/live", getLiveMatches);

router.get("/matches/upcoming", getUpcomingMatches);

router.get("/matches/past", getPastMatches);

router.get("/matches/league", getLeagueMatches);      

    

router.get("/match-activity",  getEnginePerformance);

router.get("/matches/live-stream", getLiveStream);

router.get("/matches/peak-analysis",  getPeakAnalysis);

router.get("/matches/engine-performance", getEnginePerformanceReport);

router.get("/matches/capacity-planning", getCapacityPlanning);

router.get("/matches/match-history",  getMatchHistory);

export default router;