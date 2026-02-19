import XLSX from "xlsx";

export const parseXlsx = async (buffer) => {
  try {
    // Läs workbook från buffer
    const workbook = XLSX.read(buffer, { type: "buffer" });

    // Hämta alla ark
    const sheets = {};
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      sheets[sheetName] = XLSX.utils.sheet_to_json(sheet);
    });

    return {
      sheetNames: workbook.SheetNames,
      sheets: sheets,
      firstSheet: sheets[workbook.SheetNames[0]],
      rowCount: sheets[workbook.SheetNames[0]]?.length || 0,
    };
  } catch (error) {
    console.error("XLSX parsing error:", error);
    throw new Error(`Kunde inte parsea Excelfil: ${error.message}`);
  }
};
