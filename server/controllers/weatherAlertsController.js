const { getWeatherAlerts } = require("../services/weatherAlertsService");
const { ok } = require("../utils/response");
const { ApiError } = require("../utils/errors");

const weatherAlerts = async (req, res, next) => {
  try {
    const location = String(req.query.location || req.body.location || "").trim();
    if (!location) {
      throw new ApiError("location is required", 400, "LOCATION_REQUIRED");
    }
    const payload = await getWeatherAlerts(location);
    return ok(res, payload);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  weatherAlerts
};
