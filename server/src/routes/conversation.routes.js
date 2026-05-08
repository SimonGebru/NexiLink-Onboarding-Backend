import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import {
  getConversations,
  getConversationMessages,
  sendOnboardingMessage,
  sendConversationMessage,
  markConversationAsRead,
} from "../controllers/conversation.controller.js";

const router = express.Router();

router.get("/", requireAuth, getConversations);

router.post("/:onboardingId/message", requireAuth, sendOnboardingMessage);

router.get("/:conversationId/messages", requireAuth, getConversationMessages);

router.post("/:conversationId/messages", requireAuth, sendConversationMessage);

router.patch("/:conversationId/read", requireAuth, markConversationAsRead);

export default router;
