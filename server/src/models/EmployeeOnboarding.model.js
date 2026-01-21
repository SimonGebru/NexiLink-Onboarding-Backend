import mongoose from "mongoose";

const taskItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["file", "link"],
      required: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["Ej startad", "Pågår", "Klar"],
      default: "Ej startad",
    },

    comment: {
      type: String,
      default: "",
      trim: true,
    },

    order: {
      type: Number,
      default: 0,
    },

    items: {
      type: [taskItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

const employeeOnboardingSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Program",
      required: true,
      index: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    overallStatus: {
      type: String,
      enum: ["active", "completed", "paused"],
      default: "active",
    },

    tasks: {
      type: [taskSchema],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("EmployeeOnboarding", employeeOnboardingSchema);