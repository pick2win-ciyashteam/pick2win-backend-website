import { Router } from "express";
import { adminLimiter, adminAuth } from "../../../middlewares/adminAuth.middleware.js";
import * as countryController from "./country.controller.js";
import * as countryValidation from "./country.validation.js";

const router = Router();

/* ── Countries ── */
router.post("/create", adminLimiter, adminAuth(["super_admin"]), countryValidation.addCountry, countryController.addCountry);
router.get("/get", adminLimiter, adminAuth(["super_admin"]), countryController.getAllCountries);
router.patch("/:id", adminLimiter, adminAuth(["super_admin"]), countryValidation.updateCountry, countryController.updateCountry);
router.delete("/:id", adminLimiter, adminAuth(["super_admin"]), countryController.deleteCountry);
router.patch("/:id/toggle", adminLimiter, adminAuth(["super_admin"]), countryController.toggleCountry);

export default router;