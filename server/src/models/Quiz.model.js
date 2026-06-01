import mongoose from "mongoose";

const { Schema } = mongoose;

const QuizQuestionSchema = new Schema(
  {
    question: {
      type: String,
      required: true,
    },

    options: {
  type: [String],
  validate: {
    validator: (arr) => Array.isArray(arr) && arr.length === 4,
    message: "A question must have exactly 4 options",
  },
  default: [],
},

    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },

    explanation: {
      type: String,
      default: "",
    },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },

    topic: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const QuizSchema = new Schema(
  {
    programId: {
      type: Schema.Types.ObjectId,
      ref: "Program",
      required: true,
      index: true,
    },

    sourceMaterialIds: [
      {
        type: Schema.Types.ObjectId,
        required: true,
      },
    ],

    status: {
      type: String,
      enum: ["processing", "done", "error"],
      default: "processing",
      index: true,
    },

    quiz: {
      title: {
        type: String,
        default: "",
      },

      description: {
        type: String,
        default: "",
      },

      questions: {
        type: [QuizQuestionSchema],
        default: [],
      },
    },

    errorMessage: {
      type: String,
      default: "",
    },

    meta: {
      model: {
        type: String,
        default: "",
      },
      questionCount: {
        type: Number,
        default: null,
      },
      language: {
        type: String,
        default: "sv",
      },
      materialCount: {
        type: Number,
        default: null,
      },
    },
  },
  { timestamps: true }
);

// Hämta senaste färdiga quiz för ett program effektivt
QuizSchema.index({ programId: 1, status: 1, updatedAt: -1 });

export default mongoose.model("Quiz", QuizSchema);