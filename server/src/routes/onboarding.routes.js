import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import requireRole from "../middlewares/requireRole.js";

import {
  createOnboarding,
  getOnboardingById,
  updateOnboardingTask,
  getAllOnboardings,
} from "../controllers/onboarding.controller.js";

const router = express.Router();

router.post("/", requireAuth, requireRole("admin", "hr"), createOnboarding);
router.get("/", requireAuth, requireRole("admin", "hr"), getAllOnboardings);
router.get("/:id", requireAuth, requireRole("admin", "hr"), getOnboardingById);
router.patch("/:id/tasks/:taskId", requireAuth, requireRole("admin", "hr"), updateOnboardingTask);

export default router;