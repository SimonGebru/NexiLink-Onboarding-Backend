const MAX_DOCUMENT_CHARS = 50000;

function truncateDocument(text = "") {
  const str = String(text || "").trim();
  if (str.length <= MAX_DOCUMENT_CHARS) return str;

  const keepStart = Math.floor(MAX_DOCUMENT_CHARS * 0.7);
  const keepEnd = MAX_DOCUMENT_CHARS - keepStart;

  return (
    str.slice(0, keepStart) +
    "\n\n[... mittendel av materialet utelämnad för att passa kontextfönstret ...]\n\n" +
    str.slice(-keepEnd)
  );
}

function getDifficultyDistribution(questionCount) {
  if (questionCount <= 3) {
    return {
      easyCount: 1,
      mediumCount: 1,
      hardCount: Math.max(questionCount - 2, 0),
    };
  }

  const easyCount = Math.round(questionCount * 0.34);
  const mediumCount = Math.round(questionCount * 0.33);
  const hardCount = questionCount - easyCount - mediumCount;

  return {
    easyCount,
    mediumCount,
    hardCount,
  };
}

export function buildQuizPrompt({
  program,
  materialsText,
  questionCount = 8,
  language = "sv",
}) {
  const name = program?.name || "Onboardingprogram";
  const unit = program?.unit || "Okänd enhet";
  const targetRole = program?.targetRole || "Okänd roll";
  const description = program?.description || "";

  const safeText = truncateDocument(materialsText);

  const langInstruction =
    language === "sv"
      ? "Skriv alla frågor, svarsalternativ och förklaringar på svenska."
      : `Write all questions, options and explanations in ${language}.`;

  const { easyCount, mediumCount, hardCount } =
    getDifficultyDistribution(questionCount);

  return `
Du är en erfaren utbildningsdesigner och onboarding-specialist.
Din uppgift är att skapa ett välbalanserat quiz för en nyanställd baserat på det bifogade materialet.

${langInstruction}

=== PROGRAMINFORMATION ===
- Namn: ${name}
- Enhet/sektor: ${unit}
- Målroll: ${targetRole}
${description ? `- Beskrivning: ${description}` : ""}

=== QUIZETS MÅL ===
Quizet ska verifiera att den nyanställde har förstått det viktigaste i materialet –
inte bara faktakunskap utan även praktisk tillämpning och förståelse för varför.

=== REGLER FÖR FRÅGOR ===
1. Skapa exakt ${questionCount} frågor fördelade på tre svårighetsnivåer:
   - "easy" → ${easyCount} frågor: Direkta faktafrågor från materialet.
   - "medium" → ${mediumCount} frågor: Kräver att läsaren förstår ett samband eller en process.
   - "hard" → ${hardCount} frågor: Kräver reflektion, tillämpning eller jämförelse.

2. Varje fråga ska ha exakt 4 svarsalternativ (options).
   - Exakt ett alternativ är korrekt.
   - De tre felaktiga alternativen ska vara rimliga och trovärdiga.
   - En person som inte läst materialet ska kunna tveka.
   - Undvik mönster där rätt svar alltid är längst, kortast eller ligger på samma index.

3. correctAnswer är 0-baserat index (0–3) för rätt svar.
   - Variera rätt svar mellan olika index.
   - Rätt svar får inte alltid vara 0.

4. explanation ska kort förklara:
   - varför rätt svar är korrekt
   - varför ett vanligt missförstånd skulle vara fel

5. topic anger vilket ämnesområde frågan tillhör.
   - Max 3 ord.
   - Exempel: "Säkerhetsrutiner", "Sekretess", "Dokumentation".

6. Frågorna ska vara konkreta och tydligt förankrade i materialet.
   - Undvik vaga eller generiska frågor.
   - Frågorna ska inte kunna besvaras korrekt utan att ha läst materialet.

7. Frågorna ska passa rollen "${targetRole}" och sektorn "${unit}".

=== OUTPUTFORMAT ===
Returnera ENDAST giltig JSON.
Ingen text före JSON.
Ingen text efter JSON.
Inga markdown backticks.
Inga kommentarer.

{
  "title": string,
  "description": string,
  "questions": [
    {
      "question": string,
      "options": [string, string, string, string],
      "correctAnswer": number,
      "explanation": string,
      "difficulty": "easy" | "medium" | "hard",
      "topic": string
    }
  ]
}

=== MATERIAL ===
${safeText}
`.trim();
}