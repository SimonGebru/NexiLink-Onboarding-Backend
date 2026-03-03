import express from "express";
import crypto from "crypto";
import { generateChecklistFromText } from "../services/ai/checklistGenerator.js";
import Program from "../models/Program.model.js";

const router = express.Router();

/**
 *In-memory cache 
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

router.post("/generate-checklist", async (req, res, next) => {
  try {
    const { mode, text, sourceType } = req.body;

    const modeNumber = Number(mode);
    if (![1, 2, 3].includes(modeNumber)) {
      return res.status(400).json({ ok: false, message: "mode must be 1, 2, or 3" });
    }

    if (typeof sourceType !== "undefined" && !["headings", "fulltext"].includes(sourceType)) {
      return res.status(400).json({ ok: false, message: 'sourceType must be "headings" or "fulltext"' });
    }

    const result = await generateChecklistFromText({ mode: modeNumber, text, sourceType });
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
      return res.status(400).json({ ok: false, message: "mode must be 1, 2, or 3" });
    }

    if (typeof sourceType !== "undefined" && !["headings", "fulltext"].includes(sourceType)) {
      return res.status(400).json({ ok: false, message: 'sourceType must be "headings" or "fulltext"' });
    }

    if (!Array.isArray(materialIds) || materialIds.length === 0) {
      return res.status(400).json({ ok: false, message: "materialIds cant be an empty array" });
    }

    if (materialIds.length > 5) {
      return res.status(400).json({ ok: false, message: "Maximum 5 materials allowed" });
    }

   
    const cacheKey = buildCacheKey({ programId, materialIds, mode: modeNumber, sourceType });

    // 1) Returnera cache om finns
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true });
    }

    // 2) Om samma jobb redan körs: vänta på samma promise
    if (inflight.has(cacheKey)) {
      const result = await inflight.get(cacheKey);
      return res.json({ ...result, _shared: true });
    }

    // 3) Skapa själva jobbet som en Promise och lägg i inflight
    const jobPromise = (async () => {
      const program = await Program.findById(programId);
      if (!program) {
        const e = new Error("Program not found");
        e.statusCode = 404;
        throw e;
      }

      const selectedMaterials = program.materials.filter((m) =>
        materialIds.includes(m._id.toString())
      );

      if (selectedMaterials.length === 0) {
        const e = new Error("No matching materials found");
        e.statusCode = 404;
        throw e;
      }

      const combinedText = selectedMaterials
        .map((m, index) => {
          const textToUse =
            sourceType === "headings"
              ? (m.headings?.join("\n") || "")
              : (m.extractedText || "");

          return `=== MATERIAL ${index + 1}: ${m.title || m.fileName || "Dokument"} ===\n${textToUse}`;
        })
        .join("\n\n");

      const result = await generateChecklistFromText({
        mode: modeNumber,
        text: combinedText,
        sourceType,
      });

      // cachea bara lyckade resultat
      const payload = { ok: true, result };
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
    // Om vi satte en custom statusCode:
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ ok: false, message: err.message });
    }

    console.error("Error generating checklist from materials:", err);
    next(err);
  }
});

export default router;
