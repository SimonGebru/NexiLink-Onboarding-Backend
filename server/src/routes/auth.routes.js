import express from "express";
import { login, register } from "../controllers/auth.controller.js";
import requireAuth from "../middlewares/requireAuth.js"; //bara för testning just nu

const router = express.Router();
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
router.post("/register", register);
router.post("/login", login);

export default router;