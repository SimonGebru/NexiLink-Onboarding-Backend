import express from "express";
import { generateChecklistFromText } from "../services/ai/checklistGenerator.js";

const router = express.Router();

router.post("/generate-checklist", async (req, res, next) => {
  try {
    const { mode, text } = req.body;

    const modeNumber = Number(mode);

    if (![1, 2, 3].includes(modeNumber)) {
      return res.status(400).json({
        ok: false,
        message: "mode must be 1, 2, or 3",
      });
    }

    const result = await generateChecklistFromText({
      mode: modeNumber,
      text,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;