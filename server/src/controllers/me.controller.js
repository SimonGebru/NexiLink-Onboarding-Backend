import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import EmployeeOnboarding from "../models/EmployeeOnboarding.model.js";
import User from "../models/User.model.js";

function calcProgress(tasks = []) {
  const total = tasks.length || 0;
  if (total === 0) return { total: 0, done: 0, percent: 0 };
  const done = tasks.filter((t) => t.status === "Klar").length;

  const percent = Math.round((done / total) * 100);

  return { total, done, percent };
}

async function getEmployeeContext(req) {
  
  if (req.user?.role && req.user.role !== "employee") {
    throw new ApiError(403, "Only employees can access this endpoint");
  }

  if (req.user?.role === "employee" && req.user?.employeeId) {
    return {
      userId: req.user.id,
      employeeId: req.user.employeeId,
    };
  }

  const me = await User.findById(req.user?.id).select("role employeeId").lean();

  if (!me) throw new ApiError(401, "Not authenticated");
  if (me.role !== "employee") {
    throw new ApiError(403, "Only employees can access this endpoint");
  }
  if (!me.employeeId) {
    throw new ApiError(403, "User it not linked to an employee");
  }

  return {
    userId: req.user?.id,
    employeeId: me.employeeId,
  };
}

function mapOnboardingDetails(onboarding) {
  const progress = calcProgress(onboarding.tasks);

  return {
    id: onboarding._id,
    programName: onboarding.program?.name || "",
    status: onboarding.overallStatus,
    startDate: onboarding.startDate,
    progress,
    tasks: (onboarding.tasks || []).map((t) => ({
      id: t._id,
      title: t.title || "",
      description: t.description || "",
      status: t.status || "Ej startad",
      comment: t.comment || "",
      order: typeof t.order === "number" ? t.order : 0,
      items: Array.isArray(t.items) ? t.items : [],
      questions: Array.isArray(t.questions) ? t.questions : [],
    })),
  };
}

function mapOnboardingListItem(onboarding) {
  const progress = calcProgress(onboarding.tasks);

  return {
    id: onboarding._id,
    programName: onboarding.program?.name || "",
    status: onboarding.overallStatus,
    startDate: onboarding.startDate,
    progress,
  };
}

export const getMyOnboardings = async (req, res, next) => {
  try {
    const { employeeId } = await getEmployeeContext(req);

    const onboardings = await EmployeeOnboarding.find({ employee: employeeId })
      .sort({ startDate: -1, createdAt: -1 })
      .populate("program", "name")
      .lean();

    res.json({ onboardings: onboardings.map(mapOnboardingListItem) });
  } catch (err) {
    next(err);
  }
};

export const getMyOnboardingById = async (req, res, next) => {
  try {
    const onboardingId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(onboardingId)) {
      throw new ApiError(400, "Invalid onboarding id format");
    }

    const { employeeId } = await getEmployeeContext(req);

    const onboarding = await EmployeeOnboarding.findById(onboardingId)
      .populate("program", "name")
      .lean();

    if (!onboarding) throw new ApiError(404, "Onboarding not found");

    if (String(onboarding.employee) !== String(employeeId)) {
      throw new ApiError(403, "Forbidden");
    }

    res.json(mapOnboardingDetails(onboarding));
  } catch (err) {
    next(err);
  }
};

export const updateMyOnboardingTask = async (req, res, next) => {
  try {
    const { employeeId } = await getEmployeeContext(req);
    const { id, taskId } = req.params;
    const { status, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid onboarding id format");
    }
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      throw new ApiError(400, "Invalid taskId format");
    }

    const onboarding = await EmployeeOnboarding.findById(id).populate(
      "program",
      "name",
    );
    if (!onboarding) throw new ApiError(404, "Onboarding not found");

    if (String(onboarding.employee) !== String(employeeId)) {
      throw new ApiError(403, "Forbidden");
    }

    const task = onboarding.tasks.id(taskId);
    if (!task) throw new ApiError(404, "Task not found");

    if (typeof status !== "undefined") {
      const allowed = ["Ej startad", "Pågår", "Klar"];
      if (!allowed.includes(status)) {
        throw new ApiError(
          400,
          `Invalid status. Allowed: ${allowed.join(", ")}`,
        );
      }
      task.status = status;
    }

    if (typeof comment !== "undefined") {
      task.comment = comment;
    }

    await onboarding.save();

    const fresh = await EmployeeOnboarding.findById(onboarding._id)
      .populate("program", "name")
      .lean();

    res.json(mapOnboardingDetails(fresh));
  } catch (err) {
    next(err);
  }
};
