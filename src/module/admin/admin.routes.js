import { Router } from "express";
import adminAuthRoutes       from "./admin-auth/admin.auth.route.js"
import sportmonksRoutes      from "./sportmonks/sportmonks.router.js";
import countryRoutes         from "./country/country.route.js";
import bannerRoutes          from "./banners/banners.route.js";
import subscriptionRoutes    from "./subscription/subscription.route.js";
import feedbackRoutes        from  "./feedback/feedback.route.js"

const router = Router();

router.use("/admin-auth", adminAuthRoutes);
router.use("/sportmonks", sportmonksRoutes);
router.use("/country",   countryRoutes);
router.use("/banners",bannerRoutes);
router.use("/subscription", subscriptionRoutes);
router.use("/feedback",feedbackRoutes)

export default router;