import ApiError from "../utils/ApiError.js";
import { verifyToken } from "../utils/jwt.js";

export default function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) return next(new ApiError(401, "Missing Authorization header"));

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) {
    return next(new ApiError(401, "Authorization must be: Bearer <token>"));
  }

  const decoded = verifyToken(token);

  // här standardiserar vi vad alla controllers kan förvänta sig:
  req.user = {
    id: decoded.id,
    role: decoded.role,
    email: decoded.email,
  };

  next();
}