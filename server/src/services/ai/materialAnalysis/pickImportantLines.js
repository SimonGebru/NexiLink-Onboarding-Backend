function toLines(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function looksLikeHeading(line) {
  if (!line) return false;

  
  if (line.length >= 4 && line.length <= 120 && /^[A-ZÅÄÖ0-9]/.test(line) && !/[.?!]$/.test(line)) {
    return true;
  }

  
  if (/^(\d+(\.\d+)*[\)\.]|\bkap(itel)?\b)/i.test(line)) return true;

  return false;
}

function scoreLine(line) {
  const l = line.toLowerCase();

  const keywords = [
    "ansvar",
    "roll",
    "befogen",
    "deleger",
    "samverk",
    "sekretess",
    "dokument",
    "journal",
    "anmäl",
    "orosanmäl",
    "utred",
    "bedöm",
    "insats",
    "risk",
    "avvik",
    "lex",
    "tillsyn",
    "rutin",
    "process",
    "handlägg",
    "beslut",
    "uppfölj",
    "plan",
    "genomförandeplan",
    "soL".toLowerCase(),
    "lvu",
    "lss",
    "sosfs",
    "förvaltningslag",
  ];

  let score = 0;

  if (looksLikeHeading(line)) score += 4;
  if (/§|kap\.|kapitel|SOSFS|LVU|LSS|SoL/i.test(line)) score += 6;
  if (/^[-•*]\s+/.test(line)) score += 2;
  if (/^\d+[\)\.]\s+/.test(line)) score += 2;

  for (const k of keywords) {
    if (l.includes(k)) score += 2;
  }

  // Långt stycke är oftast inte en bra “nyckelrad”
  if (line.length > 220) score -= 2;

  return score;
}

/**
 * Plockar ut ett kompakt underlag ur material utan att göra AI-anrop.
 * Tanken är att Groq bara ska få "det viktiga", inte hela dokumentet.
 */
export function pickImportantLines({
  headings = [],
  extractedText = "",
  maxChars = 12000,
  maxLines = 220,
} = {}) {
  const headingLines = Array.isArray(headings) ? headings.map((h) => String(h || "").trim()).filter(Boolean) : [];

  const textLines = toLines(extractedText);

  // Skatta och sortera “viktiga” rader
  const scored = textLines
    .map((line, idx) => ({ line, idx, score: scoreLine(line) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // Ta topp-rader men håll en gräns på antal
  const picked = [];
  const seen = new Set();

  function addLine(line) {
    const key = line.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    picked.push(line);
  }

  // 1) Lägg rubriker först om de finns
  for (const h of headingLines.slice(0, 80)) addLine(h);

  // 2) Lägg utvalda rader från texten
  for (const row of scored) {
    if (picked.length >= maxLines) break;
    addLine(row.line);
  }

  // Bygg kompakt text med hårt tecken-tak
  const compact = picked.join("\n");
  if (compact.length <= maxChars) return compact;

  return compact.slice(0, maxChars);
}