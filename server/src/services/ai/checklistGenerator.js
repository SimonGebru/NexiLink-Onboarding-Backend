import groq from "./groqClient.js";
import { buildPrompt } from "./prompts.js";

/**
 * Mode 3B: extra regler
 */
function validateChecklistForMode3B(parsed) {
  const errors = [];

  if (!parsed?.checklistTitle || !Array.isArray(parsed?.items)) {
    errors.push("Missing checklistTitle or items array");
    return errors;
  }

  const bannedSubstrings = [
    "enligt företagets rutin",
    "se till att du förstår",
    "detta är viktigt",
    "på ett korrekt sätt",
    "vad som förväntas av dig",
    "se till att du har",
    "se till att du",
    "detta är en viktig del",
    "för att säkerställa",
    "för att skydda",
    "för att undvika problem",
    "kontrollera att du har",
    "följ företagets policy",
    "följ alltid företagets",
    "tillräcklig kunskap",
    "tillräckliga behörigheter",
    "undvik att försöka lösa problemet själv",
    "du får inte glömma",
    "du får inte",
    "rapportera eventuella problem",
    "ansvarig funktion",
  ];

  parsed.items.forEach((it, idx) => {
    const title = String(it?.title || "").trim();
    const desc = String(it?.description || "").trim();
    const questions = it?.questions;

    if (!title) errors.push(`Item ${idx + 1}: missing title`);
    if (!desc) errors.push(`Item ${idx + 1}: missing description`);

    if (/^(förstå|läs)\b/i.test(title)) {
      errors.push(
        `Item ${idx + 1}: title starts with forbidden verb ("Förstå"/"Läs")`
      );
    }

    const lowerDesc = desc.toLowerCase();
    for (const banned of bannedSubstrings) {
      if (lowerDesc.includes(banned)) {
        errors.push(
          `Item ${idx + 1}: description contains banned phrase: "${banned}"`
        );
        break;
      }
    }

    if (
      !Array.isArray(questions) ||
      questions.length < 3 ||
      questions.length > 4
    ) {
      errors.push(`Item ${idx + 1}: questions must be 3–4 items`);
    }
  });

  if (parsed.items.length < 12 || parsed.items.length > 18) {
    errors.push(`Items count must be 12–18, got ${parsed.items.length}`);
  }

  return errors;
}

/**
 * JSON extraction & loose parse
 */
function extractJsonStringFromResponse(raw) {
  if (!raw) return null;

  let response = String(raw).trim();
  response = response.replace(/```json/gi, "").replace(/```/g, "");
  response = response.replace(/\r\n/g, "\n");
  response = response.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    ""
  );

  const firstBrace = response.indexOf("{");
  const lastBrace = response.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return response.slice(firstBrace, lastBrace + 1);
}

function tryParseJsonLoose(raw) {
  if (!raw) return null;

  const extracted = extractJsonStringFromResponse(raw);
  if (!extracted) return null;

  try {
    return JSON.parse(extracted);
  } catch {}

  const fixed = extracted
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(fixed);
  } catch {}

  return null;
}

/**
 * Normaliserar resultatet beroende på mode.
 * Bara mode 2 får ha phase.
 */
function normalizeChecklistByMode(parsed, mode) {
  if (!parsed || !Array.isArray(parsed.items)) return parsed;

  const normalizedItems = parsed.items.map((item, index) => {
    const validPhase =
      item?.phase === "0-30" ||
      item?.phase === "31-60" ||
      item?.phase === "61-90"
        ? item.phase
        : null;

    return {
      ...item,
      order: index + 1,
      phase: Number(mode) === 2 ? validPhase : null,
    };
  });

  return {
    ...parsed,
    items: normalizedItems,
  };
}

/**
 * ---------------- Groq caller
 * Viktigt: låt oss styra modell och max_tokens per steg.
 */
const MODELS = {
  MAP: process.env.GROQ_MODEL_MAP || "llama-3.1-8b-instant",
  REDUCE: process.env.GROQ_MODEL_REDUCE || "llama-3.3-70b-versatile",
  REPAIR: process.env.GROQ_MODEL_REPAIR || "llama-3.1-8b-instant",
};

const SYSTEM_JSON = {
  role: "system",
  content:
    'You are a JSON-only API. Return ONLY valid JSON. No prose, no markdown, no code fences.',
};

async function groqJsonCompletion({
  model,
  messages,
  max_tokens,
  temperature = 0.2,
}) {
  const payload = {
    model,
    temperature,
    max_tokens,
    messages: [SYSTEM_JSON, ...messages],
  };

  try {
    return await groq.chat.completions.create({
      ...payload,
      response_format: { type: "json_object" },
    });
  } catch (err) {
    console.error(
      "Groq response_format failed, falling back without it:",
      err?.message
    );
    return await groq.chat.completions.create(payload);
  }
}

/**
 * Groq JSON-städning
 * Styrs av env: AI_JSON_REPAIR=1
 */
async function groqRepairJsonOnly(raw) {
  const enabled = String(process.env.AI_JSON_REPAIR || "") === "1";
  if (!enabled) return null;

  const prompt = `
Fix the text below into VALID JSON only.
Rules:
- Output ONLY JSON.
- Do NOT change meaning or content.
- Only fix formatting issues.

TEXT:
${String(raw || "")}
`.trim();

  const completion = await groqJsonCompletion({
    model: MODELS.REPAIR,
    max_tokens: 900,
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  const repairedRaw = completion?.choices?.[0]?.message?.content;
  if (!repairedRaw) return null;

  return tryParseJsonLoose(repairedRaw);
}

/**
 * Map → Reduce helpers
 */
function chunkText(text, { chunkSize = 12000, overlap = 800 } = {}) {
  const clean = String(text || "");
  if (clean.length <= chunkSize) return [clean];

  const chunks = [];
  let i = 0;

  while (i < clean.length) {
    const end = Math.min(i + chunkSize, clean.length);
    chunks.push(clean.slice(i, end));
    if (end === clean.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }

  return chunks;
}

async function mapChunkToCandidates({ chunk, chunkIndex, totalChunks }) {
  const prompt = `
Extract onboarding task candidates from chunk ${chunkIndex + 1}/${totalChunks}.

Return ONLY JSON:
{
  "candidates": [
    { "title": "verb first", "description": "1-2 sentences", "hints": ["1-3 short"] }
  ]
}

Rules:
- Max 6 candidates.
- title must start with a verb. Not "Förstå" or "Läs".
- No fluff, be concrete.

CHUNK:
${chunk}
`.trim();

  const completion = await groqJsonCompletion({
    model: MODELS.MAP,
    max_tokens: 900,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  const raw = completion?.choices?.[0]?.message?.content;

  let parsed = tryParseJsonLoose(raw);
  if (!parsed) parsed = await groqRepairJsonOnly(raw);

  if (!parsed) {
    console.error("RAW MAP RESPONSE:", raw);
    throw new Error("AI returned invalid JSON format (map)");
  }

  const candidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  return candidates.slice(0, 6);
}

async function reduceCandidatesToChecklist({
  mode,
  candidates,
  sourceType,
  context,
}) {
  const compactText = candidates
    .map((c, i) => {
      const t = String(c?.title || "").trim();
      const d = String(c?.description || "").trim();
      const hints = Array.isArray(c?.hints) ? c.hints.join(", ") : "";
      return `${i + 1}. ${t}\n- ${d}\n- hints: ${hints}`.trim();
    })
    .join("\n\n");

  const prompt = buildPrompt(mode, compactText, {
    sourceType: sourceType || "fulltext",
    context,
  });

  const completion = await groqJsonCompletion({
    model: MODELS.REDUCE,
    max_tokens: 2200,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  const raw = completion?.choices?.[0]?.message?.content;

  let parsed = tryParseJsonLoose(raw);
  if (!parsed) parsed = await groqRepairJsonOnly(raw);

  if (!parsed) {
    console.error("RAW REDUCE RESPONSE:", raw);
    throw new Error("AI returned invalid JSON format (reduce)");
  }

  return parsed;
}

async function repairMode3BIfNeeded(parsed) {
  const errors = validateChecklistForMode3B(parsed);
  if (errors.length === 0) return parsed;

  const repairPrompt = `
You must return ONLY valid JSON (same schema).
Fix these errors:
${errors.map((e) => `- ${e}`).join("\n")}

Return fixed JSON:
${JSON.stringify(parsed)}
`.trim();

  const completion = await groqJsonCompletion({
    model: MODELS.REDUCE,
    max_tokens: 2400,
    messages: [{ role: "user", content: repairPrompt }],
    temperature: 0.2,
  });

  const raw = completion?.choices?.[0]?.message?.content;

  let repaired = tryParseJsonLoose(raw);
  if (!repaired) repaired = await groqRepairJsonOnly(raw);

  if (!repaired) {
    console.error("RAW REPAIR RESPONSE:", raw);
    throw new Error("AI returned invalid JSON format (repair)");
  }

  const errors2 = validateChecklistForMode3B(repaired);
  if (errors2.length > 0) {
    console.error("REPAIR STILL INVALID:", errors2);
    throw new Error("AI returned invalid JSON format (repair still invalid)");
  }

  return repaired;
}

export const generateChecklistFromText = async ({
  mode,
  text,
  sourceType,
  context = {},
}) => {
  if (!mode || !text) throw new Error("mode and text are required");

  const safeSourceType = sourceType || "fulltext";
  const isMode3B = Number(mode) === 3 && safeSourceType === "fulltext";

  const LONG_TEXT_THRESHOLD = 18000;

  if (String(text).length > LONG_TEXT_THRESHOLD) {
    const chunks = chunkText(text, { chunkSize: 12000, overlap: 800 });

    const maxChunks = 10;
    const safeChunks = chunks.slice(0, maxChunks);

    const allCandidates = [];
    for (let i = 0; i < safeChunks.length; i++) {
      const candidates = await mapChunkToCandidates({
        chunk: safeChunks[i],
        chunkIndex: i,
        totalChunks: safeChunks.length,
      });
      allCandidates.push(...candidates);
    }

    const candidatesCapped = allCandidates.slice(0, 50);

    let reduced = await reduceCandidatesToChecklist({
      mode,
      candidates: candidatesCapped,
      sourceType: safeSourceType,
      context,
    });

    if (!reduced?.checklistTitle || !Array.isArray(reduced?.items)) {
      console.error("REDUCED PARSED JSON:", reduced);
      throw new Error("AI JSON missing required structure");
    }

    if (isMode3B) {
      reduced = await repairMode3BIfNeeded(reduced);
    }

    reduced = normalizeChecklistByMode(reduced, mode);

    return reduced;
  }

  const prompt = buildPrompt(mode, text, {
    sourceType: safeSourceType,
    context,
  });

  const completion = await groqJsonCompletion({
    model: MODELS.REDUCE,
    max_tokens: 2200,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  const raw = completion?.choices?.[0]?.message?.content;

  let parsed = tryParseJsonLoose(raw);
  if (!parsed) parsed = await groqRepairJsonOnly(raw);

  if (!parsed) {
    console.error("RAW AI RESPONSE:", raw);
    throw new Error("AI returned invalid JSON format");
  }

  if (!parsed.checklistTitle || !Array.isArray(parsed.items)) {
    console.error("PARSED JSON:", parsed);
    throw new Error("AI JSON missing required structure");
  }

  if (isMode3B) {
    parsed = await repairMode3BIfNeeded(parsed);
  }

  parsed = normalizeChecklistByMode(parsed, mode);

  return parsed;
};