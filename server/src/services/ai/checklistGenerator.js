import groq from "./groqClient.js";
import { buildPrompt } from "./prompts.js";

export const generateChecklistFromText = async ({ mode, text, sourceType }) => {
  if (!mode || !text) {
    throw new Error("mode and text are required");
  }

  // Default: om inget skickas så kör vi fulltext (bra fallback)
  const safeSourceType = sourceType || "fulltext";

  const prompt = buildPrompt(mode, text, { sourceType: safeSourceType });

  let completion;

  try {
    completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    throw new Error(`Groq API error: ${err.message}`);
  }

  let response = completion?.choices?.[0]?.message?.content;

  if (!response) {
    throw new Error("AI returned empty response");
  }

  // Steg 1 – trim
  response = response.trim();

  // Steg 2 – ta bort markdown
  response = response.replace(/```json/g, "").replace(/```/g, "");

  // Steg 3 – normalisera line endings
  response = response.replace(/\r\n/g, "\n");

  // Steg 4 – ta bort farliga kontrolltecken (men behåll \n \r \t)
  response = response.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    ""
  );

  // Steg 5 – extrahera JSON-blocket (viktigast)
  const firstBrace = response.indexOf("{");
  const lastBrace = response.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    console.error("AI RESPONSE WAS:", response);
    throw new Error("AI did not return valid JSON structure");
  }

  const jsonString = response.slice(firstBrace, lastBrace + 1);

  try {
    const parsed = JSON.parse(jsonString);

    if (!parsed.checklistTitle || !Array.isArray(parsed.items)) {
      throw new Error("AI JSON missing required structure");
    }

    return parsed;
  } catch (error) {
    console.error("JSON PARSE ERROR:", error);
    console.error("RAW AI RESPONSE:", response);
    console.error("EXTRACTED JSON STRING:", jsonString);
    throw new Error("AI returned invalid JSON format");
  }
};