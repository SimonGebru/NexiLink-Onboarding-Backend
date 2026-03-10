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

function buildContextBlock(context = {}) {
  const unit = context?.program?.unit ? String(context.program.unit).trim() : "";

  const role =
    context?.program?.targetRole
      ? String(context.program.targetRole).trim()
      : context?.program?.role
      ? String(context.program.role).trim()
      : "";

  const analysis =
    context?.analysis
      ? String(context.analysis)
      : context?.analysisText
      ? String(context.analysisText)
      : "";

  const lines = [];

  if (unit || role) {
    lines.push("Programkontext:");
    if (unit) lines.push(`- Enhet: ${unit}`);
    if (role) lines.push(`- Roll: ${role}`);
  }

  if (analysis) {
    lines.push("");
    lines.push("Analys av materialet:");
    lines.push("- Använd analysen för att prioritera relevanta uppgifter.");
    lines.push(
      "- Om analysen nämner risker, ansvar, processer eller lagrum ska detta påverka både uppgifter och frågor."
    );
    lines.push("");
    lines.push(analysis);
  }

  const block = lines.join("\n").trim();
  if (!block) return "";

  return `\nKONTEXT:\n${block}\n`;
}

function buildPersona(context = {}) {
  const unit = context?.program?.unit ? String(context.program.unit).trim() : "";
  const role =
    context?.program?.targetRole
      ? String(context.program.targetRole).trim()
      : context?.program?.role
      ? String(context.program.role).trim()
      : "";

  if (role && unit) {
    return `Du är en erfaren ${role.toLowerCase()} inom ${unit.toLowerCase()} som stöttar en nyanställd kollega i introduktion och upplärning.`;
  }

  if (role) {
    return `Du är en erfaren ${role.toLowerCase()} som stöttar en nyanställd kollega i introduktion och upplärning.`;
  }

  if (unit) {
    return `Du är en erfaren medarbetare inom ${unit.toLowerCase()} som stöttar en nyanställd kollega i introduktion och upplärning.`;
  }

  return `Du är en erfaren socialsekreterare eller förste socialsekreterare som stöttar en nyanställd kollega i introduktion och upplärning.`;
}

function buildGlobalInstruction(persona) {
  return `
${persona}

Du arbetar i Nexilink – en plattform som hjälper organisationer att skapa praktiska onboarding-checklistor.

Mål:
Checklistor ska vara realistiska, användbara och fungera i ett riktigt arbete.

Varje checklist-item ska:
- vara en konkret uppgift
- vara något en nyanställd faktiskt kan utföra
- kunna bockas av när den är klar
- vara kopplad till rollen, enheten eller materialet

Undvik:
- generiska HR-formuleringar
- abstrakta uppgifter
- duplicerade uppgifter
- uppgifter som inte går att utföra i praktiken
`;
}

function buildQuestionRules({ exactThree = false } = {}) {
  return `
Frågor:
- Skriv konkreta kontrollfrågor som testar praktisk förståelse.
- Undvik generiska frågor som "Har du förstått..." eller "Känner du till...".
- Frågorna ska helst vara av dessa typer:
  1. Praktisk fråga: var eller hur gör man något?
  2. Scenariofråga: vad gör du om något händer?
  3. Ansvarsfråga: när ska du dokumentera, rapportera eller lämna vidare?
${exactThree ? "- Skriv exakt 3 frågor per item." : ""}
`;
}

/**
 * buildPrompt
 * @param {number} mode 1 | 2 | 3
 * @param {string} documentText
 * @param {object} options
 * @param {"headings"|"fulltext"} options.sourceType
 * @param {object} options.context
 */
export const buildPrompt = (mode, documentText, options = {}) => {
  const sourceType = options.sourceType || "fulltext";
  const context = options.context || {};
  const persona = buildPersona(context);
  const globalInstruction = buildGlobalInstruction(persona);
  const contextBlock = buildContextBlock(context);

  if (mode === 1) {
    return `
${globalInstruction}

Syfte:
Ge användaren en kort och praktisk startlista som kan redigeras och byggas vidare på manuellt.

Uppgift:
Skapa en kort lista med onboarding-uppgifter baserat på materialet.

Prioritera uppgifter som hjälper en nyanställd att:
- få tillgång till system
- förstå arbetsprocesser
- lära känna viktiga personer
- komma igång med arbetsuppgifter

Regler:
- Max 12 items
- phase ska alltid vara null
- description max 1 mening
- questions: 1–2 konkreta kontrollfrågor
- order ska vara 1..n i korrekt ordning
- checklistTitle ska vara "Förslag på onboarding-uppgifter"
- Undvik duplicerade titlar
- Undvik generiska uppgifter
- Undvik små detaljer som inte är viktiga i början

Bra exempel på titlar:
- Aktivera konto i verksamhetssystemet
- Gå igenom rutinen för orosanmälan
- Träffa handledare och mentor

Dåliga exempel på titlar:
- Förstå verksamheten
- Bekanta dig med organisationen
- Läs policydokument

${buildQuestionRules()}

${jsonRules}
${contextBlock}

Material:
${documentText}
`;
  }

  if (mode === 2) {
    return `
${globalInstruction}

Uppgift:
Skapa en professionell onboarding-checklista för 90 dagar uppdelad i:
- 0-30 dagar
- 31-60 dagar
- 61-90 dagar

Struktur:
0-30 dagar:
- introduktion till organisationen
- systemåtkomst
- förstå arbetsprocesser
- observera arbete
- lära känna viktiga personer och arbetssätt

31-60 dagar:
- börja arbeta mer självständigt
- hantera enklare arbetsuppgifter
- delta i möten och samarbeten
- dokumentera med stöd
- omsätta rutiner i praktiken

61-90 dagar:
- ta mer ansvar
- arbeta med mer komplexa uppgifter
- visa förståelse för rutiner och arbetssätt
- arbeta mer självständigt i rollen

Regler:
- 12–20 items totalt
- Varje item ska ha:
  - title: kort och tydlig uppgift, helst max 8–10 ord
  - description: 1–2 meningar som förklarar vad som ska göras
  - order: korrekt numerisk ordning
  - phase: "0-30" eller "31-60" eller "61-90"
  - questions: 2–3 konkreta kontrollfrågor
- checklistTitle ska vara "Onboarding-checklista 90 dagar"
- Undvik fluff
- Undvik generiska HR-formuleringar
- Undvik duplicerade uppgifter
- Lägg tidiga introduktionsuppgifter i 0-30
- Lägg inte avancerade eller självständiga uppgifter i 0-30 om de bättre passar senare
- Om analysen nämner risker, ansvar eller lagrum ska det synas i relevanta uppgifter och frågor

Dåligt exempel:
- Ta självständigt huvudansvar för komplexa ärenden i 0-30

Bättre exempel:
- Gå bredvid och observera handläggning i 0-30
- Handlägga enklare uppgifter med stöd i 31-60
- Arbeta mer självständigt i 61-90

${buildQuestionRules()}

${jsonRules}
${contextBlock}

Material:
${documentText}
`;
  }

  if (mode === 3 && sourceType === "headings") {
    return `
${globalInstruction}

Texten nedan innehåller ENDAST rubriker som användaren har markerat.
Varje rad är en rubrik.

Uppgift:
- Skapa EXAKT EN checklist-uppgift per rubrik.
- Du får INTE lägga till nya rubriker.
- Du får INTE ta bort någon rubrik.
- Du får INTE slå ihop rubriker.
- Du får INTE ändra ordningen.

Så här ska du arbeta:
- Varje rubrik blir en uppgift.
- Förbättra formuleringen försiktigt så att den blir en praktisk uppgift.
- Håll dig nära rubrikens innehåll.
- Gör inte om rubrikerna till något mer generellt än de redan är.

Regler:
- Antalet items måste vara exakt lika många som antalet rubriker
- phase ska alltid vara null
- order ska vara 1..n i exakt samma ordning
- checklistTitle ska vara "Checklista från markerade rubriker"
- description max 1 mening
- questions exakt 1 konkret kontrollfråga per uppgift
- inga duplicerade titlar
- title ska börja med ett verb
- title ska helst vara max 8 ord
- inga generiska titlar som "Övrigt"

${jsonRules}
${contextBlock}

Rubriker (en per rad):
${documentText}
`;
  }

  if (mode === 3 && sourceType === "fulltext") {
    return `
${globalInstruction}

Mål:
Skapa en praktisk och realistisk checklista direkt baserad på materialet.
Checklistan ska kunna användas i ett riktigt arbete.

ABSOLUT VIKTIGT:
- Du får INTE hitta på nya policies, system eller rutiner
- Om något inte stöds i materialet ska du inte skapa itemet
- Hellre färre men korrekta items än många generiska

Antal:
- 12–18 items
- Om materialet bara stödjer 12 starka items ska du skapa 12

Hårda regler för title:
- title måste börja med ett verb
- title måste beskriva en konkret handling

Tillåtna verb:
- Aktivera
- Registrera
- Kontrollera
- Skapa
- Dela
- Identifiera
- Rapportera
- Dokumentera
- Konfigurera
- Boka
- Genomför

Otillåtna titlar:
- Förstå
- Läs
- Bekanta dig med

Förbjudna fraser:
- "se till att"
- "detta är viktigt"
- "för att säkerställa"
- "tillräcklig kunskap"
- "följ företagets policy"
- "enligt företagets rutin"

Krav per item:
- description ska beskriva exakt vad som ska göras
- description ska vara kopplad till något i materialet
- description ska vara max 2 meningar
- om risk nämns ska det framgå vad man ska vara uppmärksam på eller undvika

${buildQuestionRules({ exactThree: true })}
- Minst 1 fråga ska vara praktisk ("var/hur")
- Minst 1 fråga ska vara scenario-baserad ("vad gör du om")
- Minst 1 fråga ska testa en konkret detalj ur materialet

Regler:
- phase alltid null
- order 1..n utan hopp
- checklistTitle ska vara "Checklista från material (detaljerad)"

${jsonRules}
${contextBlock}

Material:
${documentText}
`;
  }

  throw new Error("Invalid mode selected");
};