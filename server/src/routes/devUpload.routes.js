import express from "express";
import {
  uploadAndParse,
  uploadMultiple,
} from "../controllers/devUpload.controller.js";
import {
  uploadSingleFile,
  uploadMultipleFiles,
} from "../middlewares/upload.js";

const router = express.Router();

router.post("/parse", uploadSingleFile, uploadAndParse);

router.post("/multiple", uploadMultipleFiles, uploadMultiple);

export default router;
