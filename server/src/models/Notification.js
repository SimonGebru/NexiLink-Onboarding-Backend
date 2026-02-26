
import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true }, // "onboarding_started", ...
    title: { type: String, required: true },
    message: { type: String, default: "" },
    readAt: { type: Date, default: null },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", NotificationSchema);