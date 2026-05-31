import { Router }       from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import userAuthRoutes       from "./user-auth/user.auth.routes.js"
import seriesRoutes     from "./series/series.route.js"
import countriesRoutes   from "./countries/countries.route.js"
import matchesRoutes     from "./matches/match.route.js"
import bannerRoutes      from "./banner/banner.route.js";
import planRoutes        from "../user/subscription/subscription.route.js";
import depositeRoutes     from "../user/deposite/deposite.route.js";
import lineupRoutes      from "./lineup/lineup.route.js";
import teamsRoutes       from "./teams/teams.route.js";
 

const router = Router();

router.use("/user-auth",   userAuthRoutes);
router.use("/series", authenticate, seriesRoutes);
router.use("/countries",  countriesRoutes);
router.use("/matches",authenticate,matchesRoutes);
router.use("/banner",bannerRoutes);
router.use("/plans",planRoutes);
router.use("/deposite",authenticate,depositeRoutes);
router.use("/lineup",lineupRoutes);
router.use("/teams",authenticate,teamsRoutes);


export default router;    
