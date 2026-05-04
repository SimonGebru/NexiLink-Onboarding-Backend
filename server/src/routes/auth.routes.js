import express from "express";
import {
  acceptInvite,
  login,
  register,
} from "../controllers/auth.controller.js";
import requireAuth from "../middlewares/requireAuth.js"; //bara för testning just nu
import User from "../models/User.model.js";

const router = express.Router();
router.get("/me", requireAuth, (req, res) => {
  User.findById(req.user.id)
    .select("email role name employeeId")
    .lean()
    .then((u) => {
      if (!u)
        return res
          .status(401)
          .json({ ok: false, message: "Not authenticated" });

      res.json({
        user: {
          id: u._id,
          email: u.email,
          role: u.role,
          name: u.name,
          employeeId: u.employeeId || null,
        },
      });
    })
    .catch(() => {
      res.status(500).json({ ok: false, message: "Failed to load user" });
    });
});
router.post("/register", register);
router.post("/login", login);
router.post("/accept-invite", acceptInvite);

export default router;
