import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import requireRole from "../middlewares/requireRole.js";

import {
  createOnboarding,
  getMyOnboardings,
  getOnboardingById,
  updateOnboardingTask,
  getAllOnboardings,
} from "../controllers/onboarding.controller.js";

const router = express.Router();

router.post("/", requireAuth, requireRole("admin"), createOnboarding);

router.get("/me", requireAuth, getMyOnboardings);
router.get("/", requireAuth, getAllOnboardings);
router.get("/:id", requireAuth, getOnboardingById);

router.patch("/:id/tasks/:taskId", requireAuth, updateOnboardingTask);

export default router;