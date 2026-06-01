import Program from "../models/Program.model.js";
import Quiz from "../models/Quiz.model.js";
import ApiError from "../utils/ApiError.js";
import { generateQuiz } from "../services/ai/quiz/generateQuiz.js";


function normalizeIds(ids) {
  return (Array.isArray(ids) ? ids : [])
    .map((id) => String(id))
    .filter(Boolean)
    .sort();
}


function buildMaterialsText(materials = []) {
  return materials
    .map((material, index) => {
      const title =
        material.title || material.fileName || `Material ${index + 1}`;
      const text = (material.extractedText || "").trim();

      if (!text) return null;

      return `Material ${index + 1}: ${title}\n\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}


async function findCachedQuiz({ programId, materialIds, questionCount, language }) {
  const latest = await Quiz.findOne({
    programId,
    status: "done",
  }).sort({ updatedAt: -1 });

  if (!latest) return null;

  const cachedIds = normalizeIds(latest.sourceMaterialIds);
  const sameIds =
    cachedIds.length === materialIds.length &&
    cachedIds.every((id, i) => id === materialIds[i]);

  const sameCount = latest.quiz?.questions?.length === questionCount;
  const sameLang = (latest.meta?.language || "sv") === language;

  return sameIds && sameCount && sameLang ? latest : null;
}


export async function getLatestQuiz(req, res, next) {
  try {
    const { id: programId } = req.params;

    const latest = await Quiz.findOne({ programId, status: "done" })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ ok: true, quiz: latest || null });
  } catch (err) {
    next(err);
  }
}

export async function generateProgramQuiz(req, res, next) {
  let created = null;

  try {
    const { id: programId } = req.params;
    const {
      materialIds,
      questionCount = 8,
      language = "sv",
      force = false,
    } = req.body || {};

    // --- Validering ---

    if (!Array.isArray(materialIds) || materialIds.length === 0) {
      throw new ApiError(400, "materialIds must be a non-empty array");
    }

    if (materialIds.length > 5) {
      throw new ApiError(400, "Maximum 5 materials allowed per quiz");
    }

    const safeQuestionCount = Number(questionCount);
    if (
      !Number.isInteger(safeQuestionCount) ||
      safeQuestionCount < 3 ||
      safeQuestionCount > 15
    ) {
      throw new ApiError(400, "questionCount must be an integer between 3 and 15");
    }

    const safeLanguage = typeof language === "string" ? language.trim() : "sv";
    const safeForce = Boolean(force);

    // --- Hämta program ---

    const program = await Program.findById(programId);
    if (!program) {
      throw new ApiError(404, "Program not found");
    }

    // --- Matcha material ---

    const normalizedRequestIds = normalizeIds(materialIds);

    const selectedMaterials = (program.materials || []).filter((m) =>
      normalizedRequestIds.includes(String(m._id)),
    );

    if (selectedMaterials.length === 0) {
      throw new ApiError(404, "No matching materials found for the given materialIds");
    }

    // Varna om bara en delmängd av de begärda ID:na hittades
    const foundIds = normalizeIds(selectedMaterials.map((m) => m._id));
    const missingIds = normalizedRequestIds.filter(
      (id) => !foundIds.includes(id),
    );
    const warnings = missingIds.length > 0
      ? [`${missingIds.length} materialId(s) not found and were skipped: ${missingIds.join(", ")}`]
      : [];

    // --- Kontrollera extraherad text ---

    const materialsText = buildMaterialsText(selectedMaterials);
    if (!materialsText.trim()) {
      throw new ApiError(
        400,
        "Selected materials do not contain any extracted text",
      );
    }

    // --- Cache-kontroll ---

    if (!safeForce) {
      const cached = await findCachedQuiz({
        programId,
        materialIds: foundIds, // använd faktiskt matchade IDs
        questionCount: safeQuestionCount,
        language: safeLanguage,
      });

      if (cached) {
        return res.json({
          ok: true,
          quiz: cached,
          warnings,
          _cached: true,
        });
      }
    }


    created = await Quiz.create({
      programId,
      sourceMaterialIds: foundIds,
      status: "processing",
      quiz: {
        title: "",
        description: "",
        questions: [],
      },
      errorMessage: "",
      meta: {
        model: process.env.GROQ_MODEL_QUIZ || "llama-3.3-70b-versatile",
        questionCount: safeQuestionCount,
        language: safeLanguage,
        materialCount: selectedMaterials.length,
      },
    });



    const quiz = await generateQuiz({
      program,
      materialsText,
      questionCount: safeQuestionCount,
      language: safeLanguage,
    });

    const updated = await Quiz.findByIdAndUpdate(
      created._id,
      {
        status: "done",
        quiz,
        errorMessage: "",
      },
      { new: true },
    );

    res.status(201).json({
      ok: true,
      quiz: updated,
      warnings,
    });
  } catch (err) {
    // Markera quiz-dokumentet som misslyckat om det skapades
    if (created?._id) {
      try {
        await Quiz.findByIdAndUpdate(created._id, {
          status: "error",
          errorMessage: err?.message || "Unknown error",
        });
      } catch (updateError) {
        console.error(
          "[generateProgramQuiz] Failed to set quiz status to error:",
          updateError?.message,
        );
      }
    }

    next(err);
  }
}