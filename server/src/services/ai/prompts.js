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
- order måste vara 1,2,3... utan hopp.
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

/**
 * buildPrompt
 * @param {number} mode 1 | 2 | 3
 * @param {string} documentText - text eller rubriker beroende på mode/sourceType
 * @param {object} options
 * @param {"headings"|"fulltext"} options.sourceType - används främst för mode 3
 */
export const buildPrompt = (mode, documentText, options = {}) => {
  const sourceType = options.sourceType || "fulltext";

  
  // MODE 1 – MANUELL CHECKLISTBYGGARE
  // "AI gav mig en bra startlista – resten gör jag."
  
  if (mode === 1) {
    return `
Du är en onboarding-assistent.

Syfte:
Ge en bra startlista som användaren kan redigera och bygga vidare på manuellt.

Uppgift:
Skapa en KORT lista med förslag på onboarding-uppgifter baserat på materialet.

Regler:
- Max 12 items
- phase ska alltid vara null
- description max 1 mening
- 1–2 kontrollfrågor per item (konkreta)
- order ska vara 1..n i korrekt ordning
- checklistTitle ska vara "Förslag på onboarding-uppgifter"
- Undvik duplicerade titlar
- Prioritera det viktigaste (inte smådetaljer)

${jsonRules}

Material:
${documentText}
`;
  }

  
  // MODE 2 – MALLBASERAD (90 dagar)
  // (Senare kan vi lägga till 30/60/90 som val)
  
  if (mode === 2) {
    return `
Du är en HR-expert som bygger en strukturerad onboarding-mall.

Uppgift:
Skapa en professionell onboarding-checklista för 90 dagar uppdelad i:
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
  - 2–3 kontrollfrågor (konkreta, relevanta, inte upprepningar)
- checklistTitle ska vara "Onboarding-checklista 90 dagar"
- Undvik fluff. Utgå från materialet men fyll ut saknade “standarddelar” om det behövs.

${jsonRules}

Material:
${documentText}
`;
  }

  
  // MODE 3 – AUTOGENERERA ENKEL PUNKTLISTA
  // Två lägen:
  // 3A = headings (markerade rubriker) -> superstrikt
  // 3B = fulltext fallback -> försök hitta rubriker/ämnen
  

  // MODE 3A – rubriker markerade (en rubrik per rad)
  if (mode === 3 && sourceType === "headings") {
    return `
Du är en onboarding-assistent.

Texten nedan innehåller ENDAST rubriker som användaren har markerat.
Varje rad är en rubrik.

Uppgift:
- Skapa EXAKT EN checklist-uppgift per rubrik.
- Du får INTE lägga till nya rubriker.
- Du får INTE ta bort någon rubrik.
- Du får INTE slå ihop rubriker.
- Du får INTE ändra ordningen.

Så här ska du arbeta:
1) Varje rubrik -> en uppgift
2) Förbättra formuleringen försiktigt så den blir en praktisk uppgift
3) description: max 1 mening
4) questions: exakt 1 konkret kontrollfråga per uppgift

Regler:
- Antalet items måste vara exakt lika många som antalet rubriker.
- phase ska alltid vara null.
- order ska vara 1..n i exakt samma ordning som rubrikerna.
- checklistTitle ska vara "Checklista från markerade rubriker".
- Inga duplicerade titlar.
- Inga generiska titlar som "Övrigt".

${jsonRules}

Rubriker (en per rad):
${documentText}
`;
  }

// MODE 3B – fulltext (kvalitet före kvantitet)
if (mode === 3 && sourceType === "fulltext") {
  return `
Du är en senior onboarding- och compliance-specialist.

MÅL:
Skapa en praktisk och realistisk checklista direkt baserad på materialet.
Den ska kunna användas i ett riktigt företag.

ABSOLUT VIKTIGT:
- Du får INTE hitta på nya policies, system eller rutiner.
- Om något inte uttryckligen stöds i materialet → skapa inte itemet.
- Hellre färre men korrekta items än många generiska.

ANTAL:
- 12–18 items.
- Om materialet bara stödjer 12 starka items → skapa 12.

HÅRDA REGLER:
- title måste börja med ett verb (Aktivera, Rapportera, Spara, Dela, Identifiera, Kontrollera, etc.)
- Inga titlar som börjar med "Förstå" eller "Läs".
- Inga nya policies får introduceras om de inte står i materialet exakt.

FÖRBJUDNA FLUFF-FRASER:
- "se till att"
- "detta är viktigt"
- "för att säkerställa"
- "tillräcklig kunskap"
- "följ företagets policy"
- "enligt företagets rutin"

KRAV PER ITEM:
description ska:
1) Beskriva exakt vad som ska göras (konkret action)
2) Vara kopplad till en term från materialet
3) Om risk nämns i materialet → inkludera vad man inte får göra

questions:
- 3 frågor
- Minst 1 praktisk ("var/hur")
- Minst 1 scenario ("vad gör du om")
- Minst 1 detalj från texten

REGLER:
- phase alltid null
- order 1..n utan hopp
- checklistTitle: "Checklista från material (detaljerad)"

${jsonRules}

Material:
${documentText}
`;
}

  throw new Error("Invalid mode selected");
};