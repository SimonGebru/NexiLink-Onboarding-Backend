import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import ApiError from "../utils/ApiError.js";

// Hämta filsökväg och katalog för ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Konfig för att spara filer på disk
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../../uploads"));
  },
  filename: (req, file, cb) => {
    // Skapa unikt filnamn
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

// Konfig för att spara filer i minnet (buffer) igång just nu
const memoryStorage = multer.memoryStorage();

// Filtrera och validera filtyper
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/msword",
    "image/jpeg",
    "image/png",
    "image/jpg",
  ];

  // Kontroll om filtypen är tillåten
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `Filtypen ${file.mimetype} är inte tillåten`), false);
  }
};

// Test max storlek 10 mb
export const uploadToDisk = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

export const uploadToMemory = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

export const uploadFiles = uploadToMemory.array("files", 10);

export const uploadFields = uploadToMemory.fields([
  { name: "document", maxCount: 1 },
  { name: "attachments", maxCount: 5 },
]);

export default uploadToMemory;
