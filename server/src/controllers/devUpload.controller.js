import ApiError from "../utils/ApiError.js";
import { parsePdf } from "../services/pdf.js";
import { parseDocx } from "../services/docx.js";
import { parseXlsx } from "../services/xlsx.js";

const parsers = [
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

export const uploadAndParse = async (req, res, next) => {
  try {
    // Multer lägger filen i req.file
    if (!req.file) {
      throw new ApiError(400, "Ingen fil uppladdad");
    }

    const { originalname, mimetype, buffer, size } = req.file;

    console.log(`Uppladdad fil: ${originalname} ${mimetype}, ${size} bytes`);

    let parsedContent;
    let isParsed = false;

    // Parsa baserat på filtyp
    for (const parser of parsers) {
      if (mimetype === parser.type) {
        parsedContent = await parser.action(buffer);
        isParsed = true;
        break;
      }
    }

    if (!isParsed) {
      throw new ApiError(400, `Kan inte parsea filtyp: ${mimetype}`);
    }

    res.status(200).json({
      success: true,
      file: {
        name: originalname,
        type: mimetype,
        size: size,
      },
      content: parsedContent,
    });
  } catch (error) {
    next(error);
  }
};

// Ladda upp flera filer
export const uploadMultiple = async (req, res, next) => {
  try {
    // Multer lägger filerna i req.files
    if (!req.files || req.files.length === 0) {
      throw new ApiError(400, "Inga filer uppladdade");
    }

    const uploadedFiles = req.files.map((file) => ({
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
    }));

    res.status(200).json({
      success: true,
      message: `${req.files.length} filer uppladdade`,
      files: uploadedFiles,
    });
  } catch (error) {
    next(error);
  }
};
