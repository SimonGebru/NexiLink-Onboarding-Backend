import ApiError from "../utils/ApiError.js";

export default function errorHandler(err, req, res, next) {
  // Om någon kastar "vanliga" errors så gör vi om dem till ApiError
  const isApiError = err instanceof ApiError;

  const status = isApiError ? err.statusCode : 500;
  const message = err.message || "Internal Server Error";

  // Logga alltid i servern (men skicka inte stacken till client i prod)
  console.error("ERROR:", {
    method: req.method,
    path: req.originalUrl,
    status,
    message,
    stack: err.stack,
  });

  res.status(status).json({
    ok: false,
    status,
    message,
    // details är valfritt (bra för t.ex. validering)
    ...(isApiError && err.details ? { details: err.details } : {}),
  });
}