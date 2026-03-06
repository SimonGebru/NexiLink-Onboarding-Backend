import Program from "../models/Program.model.js";
import ProgramMaterialAnalysis from "../models/ProgramMaterialAnalysis.model.js";
import { analyzeMaterials as runMaterialAnalysis } from "../services/ai/materialAnalysis/analyzeMaterials.js";

function normalizeIds(ids) {
  return (Array.isArray(ids) ? ids : [])
    .map((x) => String(x))
    .filter(Boolean)
    .sort();
}

function sameIdSet(a, b) {
  const A = normalizeIds(a);
  const B = normalizeIds(b);
  if (A.length !== B.length) return false;
  for (let i = 0; i < A.length; i++) {
    if (A[i] !== B[i]) return false;
  }
  return true;
}

export async function getLatestProgramAnalysis(req, res, next) {
  try {
    const { id: programId } = req.params;

    const latest = await ProgramMaterialAnalysis.findOne({ programId })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ ok: true, analysis: latest || null });
  } catch (err) {
    next(err);
  }
}

export async function analyzeMaterials(req, res, next) {
  let created = null;

  try {
    const { id: programId } = req.params;
    const { materialIds, force, sourceType } = req.body || {};

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

    if (typeof sourceType !== "undefined" && !["headings", "fulltext"].includes(sourceType)) {
      return res.status(400).json({
        ok: false,
        message: 'sourceType must be "headings" or "fulltext"',
      });
    }

    const program = await Program.findById(programId).lean();
    if (!program) {
      return res.status(404).json({ ok: false, message: "Program not found" });
    }

    const selectedMaterials = (program.materials || []).filter((m) =>
      materialIds.includes(String(m._id))
    );

    if (selectedMaterials.length === 0) {
      return res.status(404).json({ ok: false, message: "No matching materials found" });
    }

    const normalizedRequestIds = normalizeIds(materialIds);

    if (!force) {
      const latestDone = await ProgramMaterialAnalysis.findOne({
        programId,
        status: "done",
      }).sort({ updatedAt: -1 });

      if (latestDone && sameIdSet(latestDone.sourceMaterialIds, normalizedRequestIds)) {
        return res.json({ ok: true, analysis: latestDone, _cached: true });
      }
    }

    created = await ProgramMaterialAnalysis.create({
      programId,
      sourceMaterialIds: normalizedRequestIds,
      status: "processing",
      result: {
        processes: [],
        legalReferences: [],
        responsibilities: [],
        risks: [],
      },
      meta: {
        model: process.env.GROQ_MODEL_ANALYSIS || "llama-3.1-8b-instant",
        sourceType: sourceType || "",
      },
    });

    const analysisResult = await runMaterialAnalysis(selectedMaterials, {
      sourceType: sourceType || "fulltext",
    });

    const updated = await ProgramMaterialAnalysis.findByIdAndUpdate(
      created._id,
      {
        status: "done",
        result: analysisResult,
        errorMessage: "",
      },
      { new: true }
    );

    return res.json({ ok: true, analysis: updated });
  } catch (err) {
    
    try {
      if (created?._id) {
        await ProgramMaterialAnalysis.findByIdAndUpdate(created._id, {
          status: "error",
          errorMessage: err?.message || "Unknown error",
        });
      }
    } catch (e) {
      console.error("Failed updating analysis status to error:", e?.message);
    }

    next(err);
  }
}