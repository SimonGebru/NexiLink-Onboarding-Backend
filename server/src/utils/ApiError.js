export default class ApiError extends Error {
  constructor(statusCode = 500, message = "Something went wrong", details = null) {
    super(message);

    this.statusCode = statusCode;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}