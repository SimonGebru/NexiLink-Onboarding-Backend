import express from "express";
import crypto from "crypto";
import { generateChecklistFromText } from "../services/ai/checklistGenerator.js";
import Program from "../models/Program.model.js";
import ProgramMaterialAnalysis from "../models/ProgramMaterialAnalysis.model.js";

const router = express.Router();

/**
 * In-memory cache
 */
const checklistCache = new Map(); // key -> { expiresAt, value }
const inflight = new Map(); // key -> Promise

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function getCache(key) {
  const hit = checklistCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    checklistCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCache(key, value) {
  checklistCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

function buildCacheKey({ programId, materialIds, mode, sourceType }) {
  const normalized = {
    programId: String(programId || ""),
    materialIds: (materialIds || []).map(String).sort(),
    mode: Number(mode),
    sourceType: sourceType || "fulltext",
  };
  return sha256(JSON.stringify(normalized));
}

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

/**
 * Gör en token-snål text av analysen. Tar bara ut det mest väsentliga, och kortar ner texten kraftigt.
 * Tanken är att den ska kunna skickas som kontext till checklist-generatorn utan att äta upp hela token-budgeten.
 */
function compactMaterialAnalysisToText(analysisDoc) {
  if (!analysisDoc?.result) return "";

  const r = analysisDoc.result;

  const lines = [];

  if (Array.isArray(r.processes) && r.processes.length) {
    lines.push("Viktiga processer:");
    r.processes.slice(0, 8).forEach((p) => {
      const name = String(p?.name || "").trim();
      if (!name) return;
      lines.push(`- ${name}`);
      const steps = Array.isArray(p?.steps) ? p.steps.slice(0, 4) : [];
      steps.forEach((s) => {
        const step = String(s || "").trim();
        if (step) lines.push(`  - ${step}`);
      });
    });
    lines.push("");
  }

  if (Array.isArray(r.legalReferences) && r.legalReferences.length) {
    lines.push("Lagrum och regler:");
    r.legalReferences.slice(0, 10).forEach((lr) => {
      const ref = String(lr?.ref || "").trim();
      const ctx = String(lr?.context || "").trim();
      if (!ref && !ctx) return;
      lines.push(`- ${ref}${ctx ? `: ${ctx}` : ""}`);
    });
    lines.push("");
  }

  if (Array.isArray(r.responsibilities) && r.responsibilities.length) {
    lines.push("Ansvar och roller:");
    r.responsibilities.slice(0, 10).forEach((x) => {
      const role = String(x?.roleOrFunction || "").trim();
      const resp = String(x?.responsibility || "").trim();
      if (!role && !resp) return;
      lines.push(`- ${role}${resp ? `: ${resp}` : ""}`);
    });
    lines.push("");
  }

  if (Array.isArray(r.risks) && r.risks.length) {
    lines.push("Risker och fallgropar:");
    r.risks.slice(0, 10).forEach((x) => {
      const risk = String(x?.risk || "").trim();
      const mit = String(x?.mitigation || "").trim();
      if (!risk && !mit) return;
      lines.push(`- ${risk}${mit ? ` (åtgärd: ${mit})` : ""}`);
    });
    lines.push("");
  }

  const combined = lines.join("\n").trim();
  return combined.slice(0, 4000);
}

async function getMatchingLatestDoneAnalysis({ programId, materialIds }) {
  const normalizedRequestIds = normalizeIds(materialIds);

  const latestDone = await ProgramMaterialAnalysis.findOne({
    programId,
    status: "done",
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (!latestDone) return null;

  if (!sameIdSet(latestDone.sourceMaterialIds, normalizedRequestIds)) {
    return null;
  }

  return latestDone;
}

router.post("/generate-checklist", async (req, res, next) => {
  try {
    const { mode, text, sourceType } = req.body;

    const modeNumber = Number(mode);
    if (![1, 2, 3].includes(modeNumber)) {
      return res
        .status(400)
        .json({ ok: false, message: "mode must be 1, 2, or 3" });
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
      context: {},
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/generate-checklist-from-materials", async (req, res, next) => {
  try {
    const { programId, materialIds, mode, sourceType } = req.body;

    const modeNumber = Number(mode);
    if (![1, 2, 3].includes(modeNumber)) {
      return res
        .status(400)
        .json({ ok: false, message: "mode must be 1, 2, or 3" });
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
      return res
        .status(400)
        .json({ ok: false, message: "materialIds cant be an empty array" });
    }

    if (materialIds.length > 5) {
      return res
        .status(400)
        .json({ ok: false, message: "Maximum 5 materials allowed" });
    }

    const cacheKey = buildCacheKey({
      programId,
      materialIds,
      mode: modeNumber,
      sourceType,
    });

    const cached = getCache(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true });
    }

    if (inflight.has(cacheKey)) {
      const result = await inflight.get(cacheKey);
      return res.json({ ...result, _shared: true });
    }

    const jobPromise = (async () => {
      const program = await Program.findById(programId);
      if (!program) {
        const e = new Error("Program not found");
        e.statusCode = 404;
        throw e;
      }

      const selectedMaterials = (program.materials || []).filter((m) =>
        materialIds.includes(String(m._id))
      );

      if (selectedMaterials.length === 0) {
        const e = new Error("No matching materials found");
        e.statusCode = 404;
        throw e;
      }

      // 1) Bygg textunderlag som innan
      const combinedText = selectedMaterials
        .map((m, index) => {
          const textToUse =
            sourceType === "headings"
              ? (m.headings?.join("\n") || "")
              : (m.extractedText || "");

          return `=== MATERIAL ${index + 1}: ${
            m.title || m.fileName || "Dokument"
          } ===\n${textToUse}`;
        })
        .join("\n\n");

      // 2) Hämta matchande analys (om den finns)
      const analysisDoc = await getMatchingLatestDoneAnalysis({
        programId,
        materialIds,
      });

      const analysisText = compactMaterialAnalysisToText(analysisDoc);

      // 3) Context till AI (enhet + roll + analys)
      const context = {
        program: {
          unit: program.unit || "",
          role: program.targetRole || "",
        },
        analysisText,
        analysisId: analysisDoc?._id ? String(analysisDoc._id) : "",
      };

      // 4) Generera checklistan
      const result = await generateChecklistFromText({
        mode: modeNumber,
        text: combinedText,
        sourceType,
        context,
      });

      const payload = {
        ok: true,
        result,
        meta: {
          analysisUsed: Boolean(analysisText),
          analysisId: analysisDoc?._id ? String(analysisDoc._id) : null,
        },
      };

      setCache(cacheKey, payload);
      return payload;
    })();

    inflight.set(cacheKey, jobPromise);

    try {
      const finalResult = await jobPromise;
      return res.json(finalResult);
    } finally {
      inflight.delete(cacheKey);
    }
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ ok: false, message: err.message });
    }

    console.error("Error generating checklist from materials:", err);
    next(err);
  }
});

export default router;
