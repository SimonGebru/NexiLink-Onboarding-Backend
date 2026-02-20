import express from "express";
import { generateChecklistFromText } from "../services/ai/checklistGenerator.js";
import Program from "../models/Program.model.js";

const router = express.Router();

router.post("/generate-checklist", async (req, res, next) => {
  try {
    const { mode, text, sourceType } = req.body;

    const modeNumber = Number(mode);

    if (![1, 2, 3].includes(modeNumber)) {
      return res.status(400).json({
        ok: false,
        message: "mode must be 1, 2, or 3",
      });
    }

    if (
      typeof sourceType !== "undefined" &&
      !["headings", "fulltext"].includes(sourceType)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'sourceType must be "headings" or "fulltext"',
      });
    }

    const result = await generateChecklistFromText({
      mode: modeNumber,
      text,
      sourceType,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Test av ny endpoint
router.post("/generate-checklist-from-materials", async (req, res, next) => {
  try {
    const { programId, materialIds, mode, sourceType } = req.body;

    const modeNumber = Number(mode);
    if (![1, 2, 3].includes(modeNumber)) {
      return res.status(400).json({
        ok: false,
        message: "mode must be 1, 2, or 3",
      });
    }

    if (
      typeof sourceType !== "undefined" &&
      !["headings", "fulltext"].includes(sourceType)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'sourceType must be "headings" or "fulltext"',
      });
    }

    if (!Array.isArray(materialIds) || materialIds.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "materialIds cant be an empty array",
      });
    }

    if (materialIds.length > 5) {
      return res.status(400).json({
        ok: false,
        message: "Maximum 5 materials allowed",
      });
    }

    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({
        ok: false,
        message: "Program not found",
      });
    }

    const selectedMaterials = program.materials.filter((m) =>
      materialIds.includes(m._id.toString()),
    );

    if (selectedMaterials.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "No matching materials found",
      });
    }

    // Kombinera text från alla materials
    const combinedText = selectedMaterials
      .map((m, index) => {
        const textToUse =
          sourceType === "headings"
            ? m.headings?.join("\n") || m.fileData
            : m.fileData;

        return `=== ${m.title} ===\n${textToUse || ""}`;
      })
      .join("\n\n");

    // Generera checklist
    const result = await generateChecklistFromText({
      mode: modeNumber,
      text: combinedText,
      sourceType,
    });

    res.json(result);
  } catch (err) {
    console.error("Error generating checklist from materials:", err);
    next(err);
  }
});

export default router;
