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
      ref: "User",
    },

    materials: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          auto: true,
        },

        type: {
          type: String,
          enum: ["file", "link"],
          required: true,
        },

        title: { type: String, default: "" },
        url: { type: String, default: "" },
        tags: { type: [String], default: [] },
        required: { type: Boolean, default: false },

        fileName: { type: String, default: "" },
        mimeType: { type: String, default: "" },
        size: { type: Number, default: 0 },

        fileData: { type: String, default: "" },

        extractedText: { type: String, default: "" },
        headings: { type: [String], default: [] },

        sourceTypeDefault: {
          type: String,
          enum: ["fulltext", "headings"],
          default: "fulltext",
        },

        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    checklistTitle: { type: String, default: "" },

    checklistTemplate: [
      {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        order: { type: Number, required: true, min: 1 },

        phase: {
          type: String,
          enum: ["0-30", "31-60", "61-90", null],
          default: null,
        },
        questions: { type: [String], default: [] },

        defaultStatus: { type: String, default: "Ej startad" },
        defaultComment: { type: String, default: "" },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Program", programSchema);
