const jsonRules = `
VIKTIGT:
- Returnera ENDAST giltig JSON.
- Ingen text före JSON.
- Ingen text efter JSON.
- Inga markdown backticks.
- Inga förklaringar.
- Inga kommentarer.
- JSON måste börja med { och sluta med }.
- order måste börja på 1.
- order får aldrig vara 0.
- order måste vara 1,2,3,4... utan hopp.
- Inga duplicerade titles.
- checklistTitle får inte vara identisk med någon item-title.

Format:
{
  "checklistTitle": string,
  "items": [
    {
      "title": string,
      "description": string,
      "order": number,
      "phase": "0-30" | "31-60" | "61-90" | null,
      "questions": [string]
    }
  ]
}
`;

export const buildPrompt = (mode, documentText) => {

  
  // MODE 1 – MANUELL CHECKLISTBYGGARE
 
  if (mode === 1) {
    return `
Du är en onboarding-assistent.

Uppgift:
Skapa en KORT lista med förslag på onboarding-uppgifter baserat på materialet.
Detta är endast ett förslag eftersom användaren bygger checklistan manuellt.

Regler:
- Max 8 items
- phase ska alltid vara null
- description max 1 mening
- 1–2 kontrollfrågor per item
- order ska vara 1..n i korrekt ordning
- checklistTitle ska vara "Förslag på onboarding-uppgifter"

${jsonRules}

Material:
${documentText}
`;
  }

  
  // MODE 2 – 90 DAGARS MALL
  
  if (mode === 2) {
    return `
Du är en HR-expert som bygger en strukturerad onboarding-mall för de första 90 dagarna.

Uppgift:
Skapa en professionell onboarding-checklista uppdelad i:
- 0-30 dagar
- 31-60 dagar
- 61-90 dagar

Regler:
- 12–20 items totalt
- Varje item ska ha:
  - Kort och tydlig title
  - description (1–2 meningar)
  - order i korrekt numerisk ordning
  - phase: "0-30" eller "31-60" eller "61-90"
  - 2–3 kontrollfrågor
- Frågorna ska vara konkreta och kunna besvaras med text.
- checklistTitle ska vara "Onboarding-checklista 90 dagar"

${jsonRules}

Material:
${documentText}
`;
  }

  
 // MODE 3 – AUTOGENERERA FRÅN MARKERADE RUBRIKER

if (mode === 3) {
  return `
Du är en onboarding-assistent.

Texten nedan innehåller ENDAST rubriker som användaren har markerat.
Varje rad är en rubrik.

Uppgift:
- Skapa EN checklist-uppgift per rubrik.
- Du får INTE lägga till nya rubriker.
- Du får INTE ta bort någon rubrik.
- Du får INTE slå ihop rubriker.
- Du får INTE ändra ordningen.

Så här ska du arbeta:
1. Använd varje rubrik som grund för en uppgift.
2. Förbättra formuleringen om det behövs så att den blir en tydlig och praktisk uppgift.
3. Skapa en kort description (max 1 mening).
4. Skapa exakt 1 konkret kontrollfråga per uppgift.

Regler:
- Antalet items måste vara exakt lika många som antalet rubriker.
- phase ska alltid vara null.
- order ska vara 1..n i exakt samma ordning som rubrikerna.
- checklistTitle ska vara "Checklista från markerade rubriker".
- Inga generiska titlar som "Övrigt".
- Inga duplicerade titlar.

${jsonRules}

Rubriker:
${documentText}
`;
}

  throw new Error("Invalid mode selected");
};