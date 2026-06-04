import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import requireRole from "../middlewares/requireRole.js";

import {
  submitQuizAttempt,
  getMyQuizAttempts,
  getOnboardingQuizAttempts,
} from "../controllers/quizAttempt.controller.js";

const router = express.Router();

router.post(
  "/onboardings/:onboardingId/quiz-attempts",
  requireAuth,
  submitQuizAttempt
);

router.get(
  "/me/quiz-attempts",
  requireAuth,
  getMyQuizAttempts
);

router.get(
  "/onboardings/:onboardingId/quiz-attempts",
  requireAuth,
  requireRole("admin", "hr"),
  getOnboardingQuizAttempts
);

export default router;