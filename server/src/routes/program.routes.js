import {
  getAllPrograms,
  updateProgram,
  deleteProgram,
  getProgramById,
  createProgram, 
} from "../controllers/program.controller.js";
import express from "express";

const router = express.Router();

router.get("/", getAllPrograms)
router.get("/:id", getProgramById)
router.patch("/:id", updateProgram)
router.post("/", createProgram)
router.delete("/:id", deleteProgram)

export default router;