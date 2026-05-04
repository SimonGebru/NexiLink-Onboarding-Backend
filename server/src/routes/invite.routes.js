import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import requireRole from "../middlewares/requireRole.js";
import { createEmployeeInvite } from "../controllers/invite.controller.js";

const router = express.Router();

router.post("/", requireAuth, requireRole("hr", "admin"), createEmployeeInvite);

export default router;
