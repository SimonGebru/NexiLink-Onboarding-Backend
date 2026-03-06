import mongoose from "mongoose";

const { Schema } = mongoose;

const SnippetSchema = new Schema(
  {
    text: { type: String, default: "" },
    materialId: { type: String, default: "" },
  },
  { _id: false }
);

const ProcessSchema = new Schema(
  {
    name: { type: String, required: true },
    steps: [{ type: String, default: "" }],
    sourceSnippets: [{ type: String, default: "" }],
  },
  { _id: false }
);

const LegalReferenceSchema = new Schema(
  {
    ref: { type: String, required: true },
    context: { type: String, default: "" },
    sourceSnippets: [{ type: String, default: "" }],
  },
  { _id: false }
);

const ResponsibilitySchema = new Schema(
  {
    roleOrFunction: { type: String, required: true },
    responsibility: { type: String, default: "" },
    sourceSnippets: [{ type: String, default: "" }],
  },
  { _id: false }
);

const RiskSchema = new Schema(
  {
    risk: { type: String, required: true },
    mitigation: { type: String, default: "" },
    sourceSnippets: [{ type: String, default: "" }],
  },
  { _id: false }
);

const ProgramMaterialAnalysisSchema = new Schema(
  {
    programId: { type: Schema.Types.ObjectId, ref: "Program", required: true, index: true },
    sourceMaterialIds: [{ type: Schema.Types.ObjectId, required: true }],

    status: {
      type: String,
      enum: ["idle", "processing", "done", "error"],
      default: "idle",
      index: true,
    },

    result: {
      processes: { type: [ProcessSchema], default: [] },
      legalReferences: { type: [LegalReferenceSchema], default: [] },
      responsibilities: { type: [ResponsibilitySchema], default: [] },
      risks: { type: [RiskSchema], default: [] },
    },

    errorMessage: { type: String, default: "" },

    meta: {
      model: { type: String, default: "" },
      sourceType: { type: String, enum: ["headings", "fulltext", ""], default: "" },
    },
  },
  { timestamps: true }
);


ProgramMaterialAnalysisSchema.index({ programId: 1, status: 1, updatedAt: -1 });

export default mongoose.model("ProgramMaterialAnalysis", ProgramMaterialAnalysisSchema);