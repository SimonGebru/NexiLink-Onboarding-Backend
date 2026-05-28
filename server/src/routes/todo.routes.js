import { Router } from "express";
import requireAuth from "../middlewares/requireAuth.js";
import {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
} from "../controllers/todo.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", getTodos);
router.post("/", createTodo);
router.put("/:id", updateTodo);
router.delete("/:id", deleteTodo);

export default router;
