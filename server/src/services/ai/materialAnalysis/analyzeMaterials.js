import groq from "../groqClient.js";
import { buildMaterialAnalysisPrompt } from "./analysisPrompts.js";
import { mergeAnalysisResults } from "./mergeAnalysisResults.js";
import { chunkText } from "./chunkText.js";
import { pickImportantLines } from "./pickImportantLines.js";

const MODEL_ANALYSIS = process.env.GROQ_MODEL_ANALYSIS || "llama-3.1-8b-instant";

const SYSTEM_JSON = {
  role: "system",
  content:
    "You are a JSON-only API. Return ONLY valid JSON. No prose, no markdown, no code fences.",
};

async function groqJsonCompletion({ messages, max_tokens = 1200, temperature = 0.2 }) {
  const payload = {
    model: MODEL_ANALYSIS,
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
    // Fallback om response_format inte stöds i någon miljö
    console.error("Groq response_format failed, fallback:", err?.message);
    return await groq.chat.completions.create(payload);
  }
}

function safeParseJson(raw) {
  if (!raw) return null;

  const s = String(raw).trim();

  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const extracted = s.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(extracted);
  } catch {
    return null;
  }
}

async function analyzeChunk(chunk) {
  const prompt = buildMaterialAnalysisPrompt(chunk);

  const response = await groqJsonCompletion({
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1200,
    temperature: 0.2,
  });

  const raw = response?.choices?.[0]?.message?.content;
  const parsed = safeParseJson(raw);

  if (!parsed) {
    console.error("AI analysis JSON parse error. Raw:", raw);
    return null;
  }

  return parsed;
}

function getMaterialText(material, sourceType = "fulltext") {
  if (!material) return "";

  const headings = Array.isArray(material.headings) ? material.headings : [];
  const extractedText = String(material.extractedText || "");

 
  return pickImportantLines({
    headings,
    extractedText,
    maxChars: 12000,
    maxLines: 220,
  });
}

async function analyzeSingleMaterial(material, { sourceType } = {}) {
  const compactText = getMaterialText(material, sourceType);

  if (!compactText || !compactText.trim()) {
    return null;
  }

  // Hårt tak på chunks så vi aldrig råkar dra iväg i kostnad
  const chunks = chunkText(compactText, { chunkSize: 4500, overlap: 250 }).slice(0, 6);

  const results = [];
  for (const chunk of chunks) {
    const result = await analyzeChunk(chunk);
    if (result) results.push(result);
  }

  if (results.length === 0) return null;

  return mergeAnalysisResults(results);
}

export async function analyzeMaterials(materials, { sourceType } = {}) {
  const results = [];

  for (const material of materials) {
    const result = await analyzeSingleMaterial(material, { sourceType });
    if (result) results.push(result);
  }

  if (results.length === 0) {
    return {
      processes: [],
      legalReferences: [],
      responsibilities: [],
      risks: [],
    };
  }

  return mergeAnalysisResults(results);
}