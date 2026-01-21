import jwt from "jsonwebtoken";
import ApiError from "./ApiError.js";

export const signToken = (payload, options = {}) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET in .env");

  const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || "7d";

  return jwt.sign(payload, secret, { expiresIn });
};

export const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET in .env");

  try {
    return jwt.verify(token, secret);
  } catch (err) {
    throw new ApiError(401, "Invalid or expired token");
  }
};