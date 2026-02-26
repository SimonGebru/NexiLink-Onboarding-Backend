import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import Notification from "../models/Notification.model.js";

export const listNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);

    const items = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      user: req.user.id,
      readAt: null,
    });

    res.json({ unreadCount });
  } catch (err) {
    next(err);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid notification id format");
    }

    const updated = await Notification.findOneAndUpdate(
      { _id: id, user: req.user.id },
      { $set: { readAt: new Date() } },
      { new: true }
    );

    if (!updated) throw new ApiError(404, "Notification not found");

    res.json({ ok: true, notification: updated });
  } catch (err) {
    next(err);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, readAt: null },
      { $set: { readAt: new Date() } }
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};