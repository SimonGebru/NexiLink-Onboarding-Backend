import mongoose from "mongoose";

const { Schema } = mongoose;

const QuizAttemptAnswerSchema = new Schema(
  {
    questionIndex: {
      type: Number,
      required: true,
      min: 0,
    },

    selectedAnswer: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },

    isCorrect: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const QuizAttemptSchema = new Schema(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    onboarding: {
      type: Schema.Types.ObjectId,
      ref: "EmployeeOnboarding",
      required: true,
      index: true,
    },

    quiz: {
      type: Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
      index: true,
    },

    answers: {
      type: [QuizAttemptAnswerSchema],
      default: [],
    },

    score: {
      type: Number,
      default: 0,
    },

    totalQuestions: {
      type: Number,
      default: 0,
    },

    percent: {
      type: Number,
      default: 0,
    },

    passed: {
      type: Boolean,
      default: false,
    },

    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

QuizAttemptSchema.index({
  employee: 1,
  onboarding: 1,
  quiz: 1,
  createdAt: -1,
});

export default mongoose.model("QuizAttempt", QuizAttemptSchema);