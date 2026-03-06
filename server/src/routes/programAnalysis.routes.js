import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import { getLatestProgramAnalysis, analyzeMaterials } from "../controllers/programAnalysis.controller.js";

const router = express.Router();

// GET senaste analysen
router.get("/:id/analysis/latest", requireAuth, getLatestProgramAnalysis);

// POST starta analys
router.post("/:id/analysis", requireAuth, analyzeMaterials);

export default router;