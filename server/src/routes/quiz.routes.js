import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import requireRole from "../middlewares/requireRole.js";
import {
  getLatestQuiz,
  generateProgramQuiz,
} from "../controllers/quiz.controller.js";

const router = express.Router();

router.get(
  "/programs/:id/quiz",
  requireAuth,
  getLatestQuiz
);

router.post(
  "/programs/:id/quiz",
  requireAuth,
  requireRole("admin", "hr"),
  generateProgramQuiz
);

export default router;