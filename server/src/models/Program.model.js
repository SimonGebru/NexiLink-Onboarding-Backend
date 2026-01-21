import mongoose from "mongoose";

const programSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    unit: {
      type: String,
    },
    targetRole: {
      type: String,
    },
    description: {
      type: String,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    materials: [
      {
        type: {
          type: String,
          enum: ["file", link],
        },
        title: String,
        url: String,
        fileName: String,
        tags: [String],
        required: Boolean,
      },
    ],
    checklistTemplate: [
      {
        title: String,
        description: String,
        order: Number,
        defaultStatus: String,
        defaultComment: String,
      },
    ],
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Program", programSchema);
