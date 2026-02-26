import express from "express";
import {
  getAllPrograms,
  updateProgram,
  deleteProgram,
  getProgramById,
  createProgram,
  uploadProgramMaterials,
  saveChecklistTemplate,
  updateProgramMaterial,      
  deleteProgramMaterial,      
} from "../controllers/program.controller.js";

import { uploadFiles } from "../middlewares/upload.js";

import requireAuth from "../middlewares/requireAuth.js";
import requireRole from "../middlewares/requireRole.js";

const router = express.Router();

router.get("/", requireAuth, getAllPrograms);
router.get("/:id", requireAuth, getProgramById);

router.post("/", requireAuth, requireRole("admin"), createProgram);

router.post("/:id/materials", requireAuth, uploadFiles, uploadProgramMaterials);
router.put("/:id/checklist-template", requireAuth, saveChecklistTemplate);

router.patch("/:id", requireAuth, updateProgram);
router.delete("/:id", requireAuth, deleteProgram);
router.patch("/:id/materials/:materialId", requireAuth, updateProgramMaterial);
router.delete("/:id/materials/:materialId", requireAuth, deleteProgramMaterial);

export default router;
