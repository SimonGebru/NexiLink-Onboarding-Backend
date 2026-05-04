import crypto from "crypto";
import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";

import EmployeeInvite from "../models/EmployeeInvite.model.js";
import Employee from "../models/Employee.model.js";
import User from "../models/User.model.js";

function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

export const createEmployeeInvite = async (req, res, next) => {
  try {
    const { employeeId, email, expiresIn = 48 } = req.body;

    if (!employeeId) throw new ApiError(400, "employeeId is required");
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      throw new ApiError(400, "Invalid employeeId format");
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) throw new ApiError(404, "Employee not found");

    const inviteEmail = String(email || employee.email || "")
      .trim()
      .toLowerCase();

    if (!inviteEmail) throw new ApiError(400, "email is required");
    if (
      inviteEmail !==
      String(employee.email || "")
        .trim()
        .toLowerCase()
    ) {
      throw new ApiError(400, "Invite email must match employee email");
    }

    const existingUser = await User.findOne({ email: inviteEmail }).lean();
    if (existingUser) {
      throw new ApiError(409, "User already exists for this email");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(token);

    const hours = Math.min(Math.max(Number(expiresIn) || 48, 1), 168);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const invite = await EmployeeInvite.create({
      employeeId: employee._id,
      email: inviteEmail,
      tokenHash,
      expiresAt,
      usedAt: null,
      invitedByUserId: req.user?.id || null,
    });

    // returnerar token/url direkt. kan komma på mail senare
    const baseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:5173";
    const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;

    res.status(201).json({
      ok: true,
      inviteId: invite._id,
      expiresAt: invite.expiresAt,
      token, // Tas bort senare när det skickas på mail
      inviteUrl,
    });
  } catch (err) {
    next(err);
  }
};
