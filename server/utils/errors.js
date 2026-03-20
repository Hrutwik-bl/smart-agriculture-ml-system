class ApiError extends Error {
  constructor(message, status = 500, code = "INTERNAL_ERROR", details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const isApiError = (error) => error instanceof ApiError;

module.exports = {
  ApiError,
  isApiError
};
