import { parsePdf } from "./pdf.js";
import { parseDocx } from "./docx.js";
import { parseXlsx } from "./xlsx.js";

export const parsers = [
  { type: "application/pdf", action: parsePdf },
  {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    action: parseDocx,
  },
  {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    action: parseXlsx,
  },
];

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export async function extractTextFromFile(material) {
  if (!material) return "";

  if (typeof material.extractedText === "string" && material.extractedText.trim()) {
    return material.extractedText;
  }

  if (typeof material.fileData === "string" && material.fileData.trim()) {
    const maybeJson = safeJsonParse(material.fileData);

    if (maybeJson && typeof maybeJson.text === "string") {
      return maybeJson.text;
    }

    return material.fileData;
  }

  return "";
}
