import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import requireRole from "../middlewares/requireRole.js";

import {
  createOnboarding,
  getOnboardingById,
  updateOnboardingTask,
} from "../controllers/onboarding.controller.js";

const router = express.Router();

router.post("/", requireAuth, requireRole("admin"), createOnboarding);
router.get("/:id", requireAuth, getOnboardingById);
router.patch("/:id/tasks/:taskId", requireAuth, updateOnboardingTask);

export default router;