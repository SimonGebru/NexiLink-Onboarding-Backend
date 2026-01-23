import bcrypt from "bcryptjs";
import ApiError from "../utils/ApiError.js";
import User from "../models/User.model.js";
import { signToken } from "../utils/jwt.js";

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
    });

    res.json({
      message: "Logged in",
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