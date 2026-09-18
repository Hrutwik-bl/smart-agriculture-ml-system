const { getDashboardData } = require("../services/dashboardService");
const { ok } = require("../utils/response");

const getDashboard = async (req, res, next) => {
  try {
    const data = await getDashboardData();
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getDashboard };
