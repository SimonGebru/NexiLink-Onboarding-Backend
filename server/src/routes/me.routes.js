import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import {
  getMyOnboardingById,
  getMyOnboardings,
  updateMyOnboardingTask,
  getMyOnboardingQuiz,
} from "../controllers/me.controller.js";

const router = express.Router();

router.get("/onboardings", requireAuth, getMyOnboardings);
router.get("/onboardings/:id", requireAuth, getMyOnboardingById);
router.get("/onboardings/:id/quiz", requireAuth, getMyOnboardingQuiz);
router.patch(
  "/onboardings/:id/tasks/:taskId",
  requireAuth,
  updateMyOnboardingTask,
);

export default router;
