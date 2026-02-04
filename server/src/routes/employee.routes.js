import express from "express";
import requireAuth from "../middlewares/requireAuth.js";
import requireRole from "../middlewares/requireRole.js";
import {
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  createEmployee,
  deleteEmployee,
} from "../controllers/employee.controller.js";

const router = express.Router();

router.get("/", requireAuth, getAllEmployees);
router.get("/:id", requireAuth, getEmployeeById);
router.post("/", requireAuth, requireRole("admin"), createEmployee);
router.patch("/:id", requireAuth, requireRole("admin"), updateEmployee);
router.delete("/:id", requireAuth, requireRole("admin"), deleteEmployee);

export default router;
