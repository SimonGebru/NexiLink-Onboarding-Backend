import groq from "./groqClient.js";
import { buildPrompt } from "./prompts.js";


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

    // Förbjud "Förstå" / "Läs" i title (enligt dina regler)
    if (/^(förstå|läs)\b/i.test(title)) {
      errors.push(`Item ${idx + 1}: title starts with forbidden verb ("Förstå"/"Läs")`);
    }

    
    const lowerDesc = desc.toLowerCase();
    for (const banned of bannedSubstrings) {
      if (lowerDesc.includes(banned)) {
        errors.push(`Item ${idx + 1}: description contains banned phrase: "${banned}"`);
        break;
      }
    }

    // Krav: 3–4 frågor i mode 3B (enligt din nya prompt)
    if (!Array.isArray(questions) || questions.length < 3 || questions.length > 4) {
      errors.push(`Item ${idx + 1}: questions must be 3–4 items`);
    }
  });

  
if (parsed.items.length < 12 || parsed.items.length > 18) {
  errors.push(`Items count must be 12–18, got ${parsed.items.length}`);
}

  return errors;
}

/**
 * Sanitize + extrahera JSON från modellens text
 */
function extractJsonStringFromResponse(raw) {
  if (!raw) return null;

  let response = String(raw).trim();

  // ta bort markdown fences om de smugit sig in
  response = response.replace(/```json/g, "").replace(/```/g, "");

  // normalisera line endings
  response = response.replace(/\r\n/g, "\n");

  // ta bort farliga kontrolltecken (men behåll \n \r \t)
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

/**
 * Gör ett Groq-call.
 * Vi försöker använda response_format om möjligt men fallbackar om det blir error.
 */
async function groqJsonCompletion(prompt) {
  // Försök 1: med response_format (om modellen stödjer)
  try {
    return await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    // Fallback: samma call utan response_format
    console.error("Groq response_format failed, falling back without it:", err?.message);
    return await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });
  }
}

export const generateChecklistFromText = async ({ mode, text, sourceType }) => {
  if (!mode || !text) {
    throw new Error("mode and text are required");
  }

  const safeSourceType = sourceType || "fulltext";
  const prompt = buildPrompt(mode, text, { sourceType: safeSourceType });

  let completion;
  try {
    completion = await groqJsonCompletion(prompt);
  } catch (err) {
    throw new Error(`Groq API error: ${err.message}`);
  }

  const raw = completion?.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("AI returned empty response");
  }

  const jsonString = extractJsonStringFromResponse(raw);
  if (!jsonString) {
    console.error("RAW AI RESPONSE:", raw);
    throw new Error("AI did not return valid JSON structure");
  }

  // 1) Första parse-försöket
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    console.error("JSON PARSE ERROR:", error);
    console.error("RAW AI RESPONSE:", raw);
    console.error("EXTRACTED JSON STRING:", jsonString);
    throw new Error("AI returned invalid JSON format");
  }

  if (!parsed.checklistTitle || !Array.isArray(parsed.items)) {
    console.error("PARSED JSON:", parsed);
    throw new Error("AI JSON missing required structure");
  }

  // 2) Extra validering + repair (bara för Mode 3B fulltext)
  const isMode3B = Number(mode) === 3 && safeSourceType === "fulltext";

  if (isMode3B) {
    const errors = validateChecklistForMode3B(parsed);

    if (errors.length > 0) {
      console.error("MODE 3B VALIDATION FAILED:", errors);

      // En reparationsrunda max (så vi inte loopar)
      const repairPrompt = `
Du returnerade giltig JSON men den bryter mot hårda regler.

FEL SOM MÅSTE FIXAS:
${errors.map((e) => `- ${e}`).join("\n")}

KRAV:
- Returnera ENDAST giltig JSON (ingen text före/efter).
- Behåll samma schema.
- Skriv om titles/descriptions/questions så att ALLA fel försvinner.
- Ta bort förbjudna fluff-fraser helt.
- Se till att antalet items blir 12–18.
- title får inte börja med "Förstå" eller "Läs".
- questions måste vara 3–4 per item.

Här är din senaste JSON (fixa den):
${JSON.stringify(parsed)}
`;

      let repairCompletion;
      try {
        repairCompletion = await groqJsonCompletion(repairPrompt);
      } catch (err) {
        throw new Error(`Groq API error (repair): ${err.message}`);
      }

      const repairRaw = repairCompletion?.choices?.[0]?.message?.content;
      if (!repairRaw) {
        throw new Error("AI returned empty response (repair)");
      }

      const repairedJsonString = extractJsonStringFromResponse(repairRaw);
      if (!repairedJsonString) {
        console.error("RAW AI REPAIR RESPONSE:", repairRaw);
        throw new Error("AI did not return valid JSON structure (repair)");
      }

      let repairedParsed;
      try {
        repairedParsed = JSON.parse(repairedJsonString);
      } catch (error) {
        console.error("JSON PARSE ERROR (repair):", error);
        console.error("RAW AI REPAIR RESPONSE:", repairRaw);
        console.error("EXTRACTED JSON STRING (repair):", repairedJsonString);
        throw new Error("AI returned invalid JSON format");
      }

      if (!repairedParsed.checklistTitle || !Array.isArray(repairedParsed.items)) {
        console.error("REPAIRED PARSED JSON:", repairedParsed);
        throw new Error("AI JSON missing required structure (repair)");
      }

      const errors2 = validateChecklistForMode3B(repairedParsed);
      if (errors2.length > 0) {
        console.error("REPAIR STILL INVALID:", errors2);
        throw new Error("AI returned invalid JSON format");
      }

      return repairedParsed;
    }
  }

  return parsed;
};