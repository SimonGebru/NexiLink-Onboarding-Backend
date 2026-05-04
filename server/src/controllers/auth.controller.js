import bcrypt from "bcryptjs";
import ApiError from "../utils/ApiError.js";
import User from "../models/User.model.js";
import { signToken } from "../utils/jwt.js";
import EmployeeInvite from "../models/EmployeeInvite.model.js";
import Employee from "../models/Employee.model.js";
import crypto from "crypto";

export const register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      throw new ApiError(400, "Email and password are required");
    }

    const existing = await User.findOne({ email });
    if (existing) throw new ApiError(409, "Email already in use");

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      passwordHash,
      name: name || email.split("@")[0],
      role: "admin", // första användaren är alltid admin
    });

    const token = signToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    res.status(201).json({
      message: "User created",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, "Email and password are required");
    }

    const user = await User.findOne({ email });
    if (!user) throw new ApiError(401, "Invalid credentials");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ApiError(401, "Invalid credentials");

    const token = signToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      employeeId: user.employeeId?.toString(),
    });

    res.json({
      message: "Logged in",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        employeeId: user.employeeId || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

export const acceptInvite = async (req, res, next) => {
  try {
    const { token, password, name } = req.body;

    if (!token) throw new ApiError(400, "token is required");
    if (!password) throw new ApiError(400, "password is required");

    const tokenHash = sha256(token);

    const invite = await EmployeeInvite.findOne({ tokenHash });
    if (!invite) throw new ApiError(400, "Invalid invite token");

    if (invite.usedAt) throw new ApiError(400, "Invite token already used");
    if (Date.now() > new Date(invite.expiresAt).getTime()) {
      throw new ApiError(400, "Invite token expired");
    }

    const email = String(invite.email || "")
      .toLowerCase()
      .trim();
    if (!email) throw new ApiError(400, "Invite is missing email");

    // Blocka om user redan finns
    const existing = await User.findOne({ email }).lean();
    if (existing) throw new ApiError(409, "User already exists");

    // Ser så employee finns
    const employee = await Employee.findById(invite.employeeId).lean();
    if (!employee) throw new ApiError(404, "Employee not found for invite");

    // Skapa user
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      passwordHash,
      name: name || employee.fullName || email.split("@")[0],
      role: "employee",
      employeeId: employee._id,
    });

    // Markera invite använd, en gångs
    invite.usedAt = new Date();
    await invite.save();

    const jwtToken = signToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      employeeId: user.employeeId?.toString(),
    });

    res.status(201).json({
      message: "Invite accepted",
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        employeeId: user.employeeId,
      },
    });
  } catch (err) {
    next(err);
  }
};
