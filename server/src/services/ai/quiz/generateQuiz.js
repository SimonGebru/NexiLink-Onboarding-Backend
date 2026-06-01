import groq from "../groqClient.js";
import { buildQuizPrompt } from "./buildQuizPrompt.js";

const MODEL = process.env.GROQ_MODEL_QUIZ || "llama-3.3-70b-versatile";

/** Tokens per fråga: fråga + 4 alternativ + förklaring + metadata */
const TOKENS_PER_QUESTION = 300;
const TOKENS_BASE = 700;
const TOKENS_MAX = 6000;

const MAX_ATTEMPTS = 3;

const SYSTEM_JSON = {
  role: "system",
  content:
    "You are a JSON-only API. Return ONLY valid JSON. No prose, no markdown, no code fences.",
};


function extractJsonStringFromResponse(raw) {
  if (!raw) return null;

  let response = String(raw).trim();

  // Ta bort eventuella markdown-kodblock
  response = response.replace(/```json/gi, "").replace(/```/g, "");
  // Normalisera radbrytningar
  response = response.replace(/\r\n/g, "\n");
  // Ta bort icke-utskrivbara kontrollkaraktärer (behåll \t och \n)
  response = response.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    "",
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

  // Försök 1: direkt
  try {
    return JSON.parse(extracted);
  } catch {}

  // Försök 2: rätta vanliga modellfel
  const fixed = extracted
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(fixed);
  } catch {}

  return null;
}


// Normalisering – mappar AI-output till ett stabilt internt format

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

function normalizeQuestion(item, index) {
  const options = Array.isArray(item?.options) ? item.options : [];
  const correctAnswer = Number(item?.correctAnswer);
  const difficulty = VALID_DIFFICULTIES.has(item?.difficulty)
    ? item.difficulty
    : "medium";

  return {
    question: String(item?.question || "").trim(),
    options: options.slice(0, 4).map((opt) => String(opt).trim()),
    correctAnswer: Number.isFinite(correctAnswer) ? correctAnswer : 0,
    explanation: String(item?.explanation || "").trim(),
    difficulty,
    topic: String(item?.topic || "").trim(),
  };
}

function normalizeQuiz(parsed) {
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

  return {
    title: String(parsed?.title || "Quiz").trim(),
    description: String(parsed?.description || "").trim(),
    questions: questions.map(normalizeQuestion),
  };
}


// Validering


function validateQuiz(quiz, expectedQuestionCount) {
  const errors = [];

  if (!quiz?.title) {
    errors.push("Quiz title is required");
  }

  if (!Array.isArray(quiz?.questions)) {
    errors.push("Quiz questions must be an array");
    return errors; // ingen mening att fortsätta
  }

  if (quiz.questions.length !== expectedQuestionCount) {
    errors.push(
      `Expected ${expectedQuestionCount} questions, got ${quiz.questions.length}`,
    );
  }

  quiz.questions.forEach((q, i) => {
    const label = `Question ${i + 1}`;

    if (!q.question) {
      errors.push(`${label}: question text is required`);
    }

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      errors.push(`${label}: must have exactly 4 options`);
    } else if (q.options.some((opt) => !opt)) {
      errors.push(`${label}: all options must be non-empty strings`);
    }

    if (
      !Number.isInteger(q.correctAnswer) ||
      q.correctAnswer < 0 ||
      q.correctAnswer > 3
    ) {
      errors.push(`${label}: correctAnswer must be 0, 1, 2 or 3`);
    }

    if (!q.explanation) {
      errors.push(`${label}: explanation is required`);
    }

    if (!VALID_DIFFICULTIES.has(q.difficulty)) {
      errors.push(`${label}: difficulty must be easy, medium or hard`);
    }
  });

  return errors;
}


// Groq API-anrop

function calcMaxTokens(questionCount) {
  return Math.min(TOKENS_BASE + questionCount * TOKENS_PER_QUESTION, TOKENS_MAX);
}

async function groqJsonCompletion({ messages, max_tokens, temperature = 0.2 }) {
  const payload = {
    model: MODEL,
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
    // Vissa Groq-modeller stöder inte response_format – fallback utan det
    console.warn(
      "[generateQuiz] response_format not supported, retrying without it:",
      err?.message,
    );
    return await groq.chat.completions.create(payload);
  }
}


// Huvud-export

/**
 * Genererar ett quiz från onboardingmaterial via Groq.
 *
 * @param {object} params
 * @param {object} params.program         - Programmetadata
 * @param {string} params.materialsText   - Råtext från uppladdade dokument
 * @param {number} [params.questionCount=8]
 * @param {string} [params.language="sv"] - Språk för quizet
 * @returns {Promise<{title: string, description: string, questions: object[]}>}
 */
export async function generateQuiz({
  program,
  materialsText,
  questionCount = 8,
  language = "sv",
}) {
  if (!program) {
    throw new Error("program is required");
  }
  if (!materialsText || !String(materialsText).trim()) {
    throw new Error("materialsText is required");
  }

  const prompt = buildQuizPrompt({
    program,
    materialsText,
    questionCount,
    language,
  });

  const max_tokens = calcMaxTokens(questionCount);
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    
    const temperature = attempt === 1 ? 0.2 : 0.4;

    try {
      const completion = await groqJsonCompletion({
        max_tokens,
        messages: [{ role: "user", content: prompt }],
        temperature,
      });

      const raw = completion?.choices?.[0]?.message?.content;

      if (!raw) {
        lastError = new Error("Empty response from AI");
        console.warn(`[generateQuiz] Attempt ${attempt}: empty response`);
        continue;
      }

      const parsed = tryParseJsonLoose(raw);

      if (!parsed) {
        lastError = new Error("AI returned invalid JSON");
        console.warn(`[generateQuiz] Attempt ${attempt}: JSON parse failed`);
        console.debug("[generateQuiz] Raw response:", raw?.slice(0, 500));
        continue;
      }

      const quiz = normalizeQuiz(parsed);
      const errors = validateQuiz(quiz, questionCount);

      if (errors.length > 0) {
        lastError = new Error(
          `Invalid quiz structure: ${errors.slice(0, 3).join("; ")}`,
        );
        console.warn(
          `[generateQuiz] Attempt ${attempt}: validation failed –`,
          errors,
        );
        continue;
      }

      if (attempt > 1) {
        console.info(`[generateQuiz] Succeeded on attempt ${attempt}`);
      }

      return quiz;

    } catch (err) {
      lastError = err;
      console.error(`[generateQuiz] Attempt ${attempt}: unexpected error –`, err?.message);
    }
  }

  // Alla försök misslyckades
  throw new Error(
    `Failed to generate valid quiz after ${MAX_ATTEMPTS} attempts. Last error: ${lastError?.message}`,
  );
}