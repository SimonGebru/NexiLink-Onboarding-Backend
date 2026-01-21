import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.model.js";

const router = express.Router();

router.get("/ping", (req, res) => {
  res.json({ ok: true, msg: "seed routes reached" });
});

router.post("/seed-user", async (req, res) => {
  const { email = "admin@nexilink.se", password = "123456" } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.json({
      message: "User already exists",
      userId: existing._id,
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    email,
    passwordHash,
    role: "admin",
    name: "Seed Admin",
  });

  res.status(201).json({
    message: "Seed user created",
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
    },
  });
});

export default router;