const { getAlerts } = require("../services/alertsService");
const { ok } = require("../utils/response");

const getAllAlerts = async (req, res, next) => {
  try {
    const data = await getAlerts();
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getAllAlerts };
