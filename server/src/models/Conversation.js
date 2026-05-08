import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    onboardingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Onboarding",
      required: true,
      index: true,
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
  },
  { timestamps: true }
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;