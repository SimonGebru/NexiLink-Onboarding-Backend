import express from "express";
import requireAuth from "../middlewares/requireAuth.js";

import { getDashboardFeed } from "../controllers/dashboard.controller.js";

const router = express.Router();


router.get("/feed", requireAuth, getDashboardFeed);

export default router;