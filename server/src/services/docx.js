import mammoth from "mammoth";

export const parseDocx = async (buffer) => {
  try {
    // Extrahera text från buffer
    const result = await mammoth.extractRawText({ buffer });

    return {
      text: result.value,
    };
  } catch (error) {
    console.error("DOCX parsing error:", error);
    throw new Error(`Kunde inte parsa Word-dokument: ${error.message}`);
  }
};
