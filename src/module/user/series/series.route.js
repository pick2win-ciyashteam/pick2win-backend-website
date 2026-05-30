
import express from "express";

import { getAllSeries, getSeriesById } from "./series.controller.js";
import { authenticate } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/:seriesid", authenticate,  getSeriesById);

router.get("/", authenticate,  getAllSeries);  
  

export default router;
    