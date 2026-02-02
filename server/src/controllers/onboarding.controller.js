import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";

import EmployeeOnboarding from "../models/EmployeeOnboarding.model.js";
import Employee from "../models/Employee.model.js";
import Program from "../models/Program.model.js";

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
      .populate("program");

    const mapped = onboardings.map((o) => {
      const progress = calcProgress(o.tasks);
      return { onboarding: o, progress };
    });

    res.json(mapped);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /onboardings
 * body: { employeeId, programId, startDate }
 */
export const createOnboarding = async (req, res, next) => {
  try {
    const { employeeId, programId, startDate } = req.body;

    if (!employeeId || !programId || !startDate) {
      throw new ApiError(400, "employeeId, programId and startDate are required");
    }

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      throw new ApiError(400, "Invalid employeeId format");
    }
    if (!mongoose.Types.ObjectId.isValid(programId)) {
      throw new ApiError(400, "Invalid programId format");
    }

    // Viktigt: employee måste finnas + vara aktiv 
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new ApiError(404, "Employee not found");
    if (employee.active === false) {
      throw new ApiError(400, "Employee is inactive");
    }

    const program = await Program.findById(programId);
    if (!program) throw new ApiError(404, "Program not found");

    // Bygg tasks från programmets checklistTemplate
    const template = Array.isArray(program.checklistTemplate)
      ? program.checklistTemplate
      : [];

    const tasks = template
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((t) => ({
        title: t.title,
        status: t.defaultStatus || "Ej startad",
        comment: t.defaultComment || "",
        order: t.order ?? 0,
        items: [],
      }));

    const onboarding = await EmployeeOnboarding.create({
      employee: employee._id,
      program: program._id,
      startDate: new Date(startDate),
      tasks,
      
      createdBy: req.user?.id || null,
    });

    // populate så frontend slipper extra calls
    const populated = await EmployeeOnboarding.findById(onboarding._id)
      .populate("employee")
      .populate("program");

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

    // populate här också (valfritt men nice)
    const onboarding = await EmployeeOnboarding.findById(id)
      .populate("employee")
      .populate("program");

    if (!onboarding) throw new ApiError(404, "Onboarding not found");

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
    if (!onboarding) throw new ApiError(404, "Onboarding not found");

    const task = onboarding.tasks.id(taskId);
    if (!task) throw new ApiError(404, "Task not found");

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

    const progress = calcProgress(onboarding.tasks);

    res.json({
      onboarding,
      progress,
    });
  } catch (err) {
    next(err);
  }
};