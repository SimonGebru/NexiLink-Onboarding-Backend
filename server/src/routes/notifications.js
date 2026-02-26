
import { Router } from "express";
import Notification from "../models/Notification.js";
import requireAuth from "../middlewares/requireAuth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const unreadOnly = req.query.unreadOnly === "true";

  const filter = { userId: req.user.id };
  if (unreadOnly) filter.readAt = null;

  const items = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(30);

  const unreadCount = await Notification.countDocuments({
    userId: req.user.id,
    readAt: null,
  });

  res.json({ unreadCount, items });
});

router.patch("/:id/read", requireAuth, async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { readAt: new Date() },
    { new: true }
  );

  if (!n) return res.status(404).json({ message: "Notis hittades inte" });
  res.json(n);
});

router.patch("/read-all", requireAuth, async (req, res) => {
  await Notification.updateMany(
    { userId: req.user.id, readAt: null },
    { readAt: new Date() }
  );
  res.json({ ok: true });
});

export default router;