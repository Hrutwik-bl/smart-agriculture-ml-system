const ok = (res, data, meta = {}) => res.json({ success: true, data, meta });

const fail = (res, error, status = 500) =>
  res.status(status).json({
    success: false,
    error: {
      message: error.message || "Request failed",
      code: error.code || "REQUEST_FAILED",
      details: error.details || null
    }
  });

module.exports = {
  ok,
  fail
};
