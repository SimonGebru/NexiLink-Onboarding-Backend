import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.model.js";
import EmployeeOnboarding from "../models/EmployeeOnboarding.model.js";
import ApiError from "../utils/ApiError.js";

const emitMessageEvents = (req, conversation, message) => {
  const io = req.app.get("io");

  if (!io) return;

  const conversationId = conversation._id.toString();

  io.to(conversationId).emit("message:new", {
    conversationId,
    message,
  });

  io.to(conversationId).emit("conversation:updated", {
    conversationId,
    lastMessage: message,
    lastMessageAt: conversation.lastMessageAt,
  });
};

export const sendOnboardingMessage = async (req, res, next) => {
  try {
    const { onboardingId } = req.params;
    const { body } = req.body;
    const userId = req.user.id;

    if (!body || !body.trim()) {
      return next(new ApiError(400, "Message body is required"));
    }

    const onboarding = await EmployeeOnboarding.findById(onboardingId);

    if (!onboarding) {
      return next(new ApiError(404, "Onboarding not found"));
    }

    if (!onboarding.createdBy) {
      return next(
        new ApiError(400, "This onboarding does not have a responsible HR user")
      );
    }

    const employeeUser = await User.findOne({
      employeeId: onboarding.employee,
    });

    if (!employeeUser) {
      return next(
        new ApiError(400, "No user account found for this onboarding employee")
      );
    }

    const employeeUserId = employeeUser._id.toString();
    const hrUserId = onboarding.createdBy.toString();

    const isEmployee = userId === employeeUserId;
    const isResponsibleHr = userId === hrUserId;
    const isAdminOrHr = req.user.role === "admin" || req.user.role === "hr";

    if (!isEmployee && !isResponsibleHr && !isAdminOrHr) {
      return next(
        new ApiError(403, "You are not allowed to message about this onboarding")
      );
    }

    let conversation = await Conversation.findOne({ onboardingId });

    if (!conversation) {
      conversation = await Conversation.create({
        onboardingId,
        participants: [employeeUserId, hrUserId],
        createdBy: userId,
        lastMessageAt: new Date(),
      });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      sender: userId,
      body: body.trim(),
      readBy: [userId],
    });

    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populatedMessage = await message.populate("sender", "name email role");

    emitMessageEvents(req, conversation, populatedMessage);

    res.status(201).json({
      success: true,
      data: {
        conversation,
        message: populatedMessage,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return next(new ApiError(404, "Conversation not found"));
    }

    const isParticipant = conversation.participants.some(
      (participantId) => participantId.toString() === userId
    );

    const isAdminOrHr = req.user.role === "admin" || req.user.role === "hr";

    if (!isParticipant && !isAdminOrHr) {
      return next(
        new ApiError(403, "You are not allowed to view this conversation")
      );
    }

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .populate("sender", "name email role");

    res.json({
      success: true,
      data: {
        conversation,
        messages,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const isAdminOrHr = req.user.role === "admin" || req.user.role === "hr";

    const filter = isAdminOrHr ? {} : { participants: userId };

    const conversations = await Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .populate("participants", "name email role");

    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conversation) => {
        const lastMessage = await Message.findOne({
          conversationId: conversation._id,
        })
          .sort({ createdAt: -1 })
          .populate("sender", "name email role");

        const unreadCount = await Message.countDocuments({
          conversationId: conversation._id,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        });

        return {
          ...conversation.toObject(),
          lastMessage,
          unreadCount,
        };
      })
    );

    res.json({
      success: true,
      data: conversationsWithLastMessage,
    });
  } catch (error) {
    next(error);
  }
};

export const sendConversationMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { body } = req.body;
    const userId = req.user.id;

    if (!body || !body.trim()) {
      return next(new ApiError(400, "Message body is required"));
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return next(new ApiError(404, "Conversation not found"));
    }

    const isParticipant = conversation.participants.some(
      (participantId) => participantId.toString() === userId
    );

    const isAdminOrHr = req.user.role === "admin" || req.user.role === "hr";

    if (!isParticipant && !isAdminOrHr) {
      return next(
        new ApiError(
          403,
          "You are not allowed to send messages in this conversation"
        )
      );
    }

    if (!isParticipant) {
      conversation.participants.push(userId);
    }

    const message = await Message.create({
      conversationId: conversation._id,
      sender: userId,
      body: body.trim(),
      readBy: [userId],
    });

    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populatedMessage = await message.populate("sender", "name email role");

    emitMessageEvents(req, conversation, populatedMessage);

    res.status(201).json({
      success: true,
      data: {
        conversation,
        message: populatedMessage,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const markConversationAsRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return next(new ApiError(404, "Conversation not found"));
    }

    const isParticipant = conversation.participants.some(
      (participantId) => participantId.toString() === userId
    );

    const isAdminOrHr = req.user.role === "admin" || req.user.role === "hr";

    if (!isParticipant && !isAdminOrHr) {
      return next(
        new ApiError(403, "You are not allowed to read this conversation")
      );
    }

    await Message.updateMany(
      {
        conversationId,
        readBy: { $ne: userId },
      },
      {
        $addToSet: { readBy: userId },
      }
    );

    res.json({
      success: true,
      message: "Conversation marked as read",
    });
  } catch (error) {
    next(error);
  }
};