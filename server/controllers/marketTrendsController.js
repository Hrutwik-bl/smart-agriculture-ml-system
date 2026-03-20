const { getMarketTrends } = require("../services/marketTrendsService");
const { ok } = require("../utils/response");

const marketTrends = async (req, res, next) => {
  try {
    const location = String(req.body.location || req.query.location || "").trim();
    const result = await getMarketTrends({ location });
    return ok(res, {
      location,
      ...result
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  marketTrends
};
