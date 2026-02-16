import { PDFParse } from "pdf-parse";

export const parsePdf = async (buffer) => {
  let parser = null;
  try {
    // Skapar en instans av pdfparse
    parser = new PDFParse({ data: buffer });

    // Extraherar text
    const result = await parser.getText();

    return {
      text: result.text || ""
    };
  } catch (error) {
    console.error("Parsing error:", error);
    throw new Error(`Kunde inte parsea PDF: ${error.message}`);
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }
};
