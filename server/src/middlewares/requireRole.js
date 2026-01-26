import ApiError from "../utils/ApiError.js";

export default function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, "Not authenticated"));

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, "Forbidden: insufficient role"));
    }

    next();
  };
}