const { getHistoryData } = require("../services/historyService");
const { ok } = require("../utils/response");

const getHistory = async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days || "7", 10), 90);
    const data = await getHistoryData(days);
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getHistory };
