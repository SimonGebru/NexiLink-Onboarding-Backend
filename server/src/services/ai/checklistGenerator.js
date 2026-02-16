import groq from "./groqClient.js";
import { buildPrompt } from "./prompts.js";

export const generateChecklistFromText = async ({ mode, text }) => {
  if (!mode || !text) {
    throw new Error("mode and text are required");
  }

  const prompt = buildPrompt(mode, text);

  let completion;

  try {
    completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
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

  // Steg 3 – ta bort ogiltiga kontrolltecken
  response = response.replace(/[\u0000-\u001F\u007F]/g, "");

  // Steg 4 – extrahera JSON-block
  const jsonMatch = response.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    console.error("AI RESPONSE WAS:", response);
    throw new Error("AI did not return valid JSON block");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Extra säkerhet
    if (!parsed.checklistTitle || !Array.isArray(parsed.items)) {
      throw new Error("AI JSON missing required structure");
    }

    return parsed;
  } catch (error) {
    console.error("JSON PARSE ERROR:", error);
    console.error("RAW AI RESPONSE:", response);
    throw new Error("AI returned invalid JSON format");
  }
};