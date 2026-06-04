import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";

import EmployeeOnboarding from "../models/EmployeeOnboarding.model.js";
import Employee from "../models/Employee.model.js";
import Program from "../models/Program.model.js";
import Quiz from "../models/Quiz.model.js";
import Notification from "../models/Notification.js";

/**
 * Hjälpfunktion: räkna progress i %
 * Klar = status === "Klar"
 */
function calcProgress(tasks = []) {
  const total = tasks.length || 0;
  if (total === 0) return { total: 0, done: 0, percent: 0 };

  const done = tasks.filter((t) => t.status === "Klar").length;
  const percent = Math.round((done / total) * 100);

  return { total, done, percent };
}

/**
 * GET /onboardings
 * query: ?status=active&limit=20
 * Returnerar lista av onboardings (populated) + progress per onboarding.
 */
export const getAllOnboardings = async (req, res, next) => {
  try {
    const { status = "active", limit = 20 } = req.query;

    const allowedStatuses = ["active", "completed", "paused", "all"];
    if (!allowedStatuses.includes(status)) {
      throw new ApiError(
        400,
        `Invalid status. Allowed: ${allowedStatuses.join(", ")}`
      );
    }

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const filter = status === "all" ? {} : { overallStatus: status };

    const onboardings = await EmployeeOnboarding.find(filter)
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .populate("employee")
      .populate("program")
      .populate("assignedQuiz");

    const mapped = onboardings.map((onboarding) => ({
      onboarding,
      progress: calcProgress(onboarding.tasks),
    }));

    res.json(mapped);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /onboardings
 * body: { employeeId, programId, startDate, quizId? }
 */
export const createOnboarding = async (req, res, next) => {
  try {
    const { employeeId, programId, startDate, quizId, includeChecklist = true } =
  req.body;

    if (!employeeId || !programId || !startDate) {
      throw new ApiError(
        400,
        "employeeId, programId and startDate are required"
      );
    }

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      throw new ApiError(400, "Invalid employeeId format");
    }

    if (!mongoose.Types.ObjectId.isValid(programId)) {
      throw new ApiError(400, "Invalid programId format");
    }

    if (quizId && !mongoose.Types.ObjectId.isValid(quizId)) {
      throw new ApiError(400, "Invalid quizId format");
    }

    const employee = await Employee.findById(employeeId);

    if (!employee) {
      throw new ApiError(404, "Employee not found");
    }

    if (employee.active === false) {
      throw new ApiError(400, "Employee is inactive");
    }

    const program = await Program.findById(programId);

    if (!program) {
      throw new ApiError(404, "Program not found");
    }

    let assignedQuiz = null;

    if (quizId) {
      const quiz = await Quiz.findById(quizId);

      if (!quiz) {
        throw new ApiError(404, "Quiz not found");
      }

      if (quiz.status !== "done") {
        throw new ApiError(400, "Quiz must be generated before assigning");
      }

      if (quiz.programId.toString() !== programId) {
        throw new ApiError(
          400,
          "Quiz does not belong to the selected program"
        );
      }

      assignedQuiz = quiz._id;
    }

    const shouldIncludeChecklist = Boolean(includeChecklist);

const template =
  shouldIncludeChecklist && Array.isArray(program.checklistTemplate)
    ? program.checklistTemplate
    : [];

const tasks = template
  .slice()
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  .map((task) => ({
    title: task.title,
    description: task.description || "",
    status: task.defaultStatus || "Ej startad",
    comment: task.defaultComment || "",
    order: task.order ?? 0,
    items: [],
    questions: task.questions || [],
  }));

    const onboarding = await EmployeeOnboarding.create({
      employee: employee._id,
      program: program._id,
      startDate: new Date(startDate),
      tasks,
      assignedQuiz,
      createdBy: req.user?.id || null,
    });

    if (req.user?.id) {
      await Notification.create({
        userId: req.user.id,
        type: "onboarding_started",
        title: "Onboarding startad",
        message: `${employee.fullName} • ${program.name}`,
        meta: {
          onboardingId: onboarding._id,
          employeeId: employee._id,
          programId: program._id,
          quizId: assignedQuiz,
        },
      });
    }

    const populated = await EmployeeOnboarding.findById(onboarding._id)
      .populate("employee")
      .populate("program")
      .populate("assignedQuiz");

    const progress = calcProgress(populated.tasks);

    res.status(201).json({
      onboarding: populated,
      progress,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /onboardings/:id
 */
export const getOnboardingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid onboarding id format");
    }

    const onboarding = await EmployeeOnboarding.findById(id)
      .populate("employee")
      .populate("program")
      .populate("assignedQuiz");

    if (!onboarding) {
      throw new ApiError(404, "Onboarding not found");
    }

    const isAdminOrHr = req.user.role === "admin" || req.user.role === "hr";

    const isEmployeeOwner =
      req.user.role === "employee" &&
      req.user.employeeId &&
      onboarding.employee?._id?.toString() === req.user.employeeId.toString();

    if (!isAdminOrHr && !isEmployeeOwner) {
      throw new ApiError(403, "You are not allowed to view this onboarding");
    }

    const progress = calcProgress(onboarding.tasks);

    res.json({
      onboarding,
      progress,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /onboardings/:id/tasks/:taskId
 * body: { status?, comment? }
 */
export const updateOnboardingTask = async (req, res, next) => {
  try {
    const { id, taskId } = req.params;
    const { status, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid onboarding id format");
    }

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      throw new ApiError(400, "Invalid taskId format");
    }

    const onboarding = await EmployeeOnboarding.findById(id);

    if (!onboarding) {
      throw new ApiError(404, "Onboarding not found");
    }

    const task = onboarding.tasks.id(taskId);

    if (!task) {
      throw new ApiError(404, "Task not found");
    }

    const prevStatus = task.status;

    if (typeof status !== "undefined") {
      const allowed = ["Ej startad", "Pågår", "Klar"];

      if (!allowed.includes(status)) {
        throw new ApiError(
          400,
          `Invalid status. Allowed: ${allowed.join(", ")}`
        );
      }

      task.status = status;
    }

    if (typeof comment !== "undefined") {
      task.comment = comment;
    }

    await onboarding.save();

    if (
      req.user?.id &&
      typeof status !== "undefined" &&
      prevStatus !== "Klar" &&
      status === "Klar"
    ) {
      const populated = await EmployeeOnboarding.findById(onboarding._id)
        .populate("employee")
        .populate("program")
        .populate("assignedQuiz");

      await Notification.create({
        userId: req.user.id,
        type: "task_completed",
        title: "Uppgift klar",
        message: `${populated.employee?.fullName || "Nyanställd"} • ${
          task.title
        }`,
        meta: {
          onboardingId: onboarding._id,
          employeeId: populated.employee?._id || null,
          programId: populated.program?._id || null,
          taskId,
        },
      });
    }

    if (req.user?.id) {
      const progressNow = calcProgress(onboarding.tasks);
      const wasCompleted = onboarding.overallStatus === "completed";

      if (!wasCompleted && progressNow.percent === 100) {
        onboarding.overallStatus = "completed";
        await onboarding.save();

        const populated = await EmployeeOnboarding.findById(onboarding._id)
          .populate("employee")
          .populate("program")
          .populate("assignedQuiz");

        await Notification.create({
          userId: req.user.id,
          type: "onboarding_completed",
          title: "Onboarding klar",
          message: `${populated.employee?.fullName || "Nyanställd"} • ${
            populated.program?.name || "Program"
          }`,
          meta: {
            onboardingId: onboarding._id,
            employeeId: populated.employee?._id || null,
            programId: populated.program?._id || null,
          },
        });
      }
    }

    const populated = await EmployeeOnboarding.findById(onboarding._id)
      .populate("employee")
      .populate("program")
      .populate("assignedQuiz");

    const progress = calcProgress(populated.tasks);

    res.json({
      onboarding: populated,
      progress,
    });
  } catch (err) {
    next(err);
  }
};

export const getMyOnboardings = async (req, res, next) => {
  try {
    const employeeId = req.user?.employeeId;

    if (!employeeId) {
      throw new ApiError(401, "No employeeId found on user");
    }

    const onboardings = await EmployeeOnboarding.find({
      employee: employeeId,
    })
      .sort({ createdAt: -1 })
      .populate("employee")
      .populate("program")
      .populate("assignedQuiz");

    const result = onboardings.map((onboarding) => ({
      onboarding,
      progress: calcProgress(onboarding.tasks),
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
};