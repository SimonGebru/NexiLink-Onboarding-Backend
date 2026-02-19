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
