const { getPricePrediction } = require("../services/pricePredictionService");
const { ok } = require("../utils/response");

const pricePrediction = async (req, res, next) => {
  try {
    const crop = String(req.body.crop || req.query.crop || "").trim();
    const location = String(req.body.location || req.query.location || "").trim();
    const state = String(req.body.state || req.query.state || "").trim();
    const result = await getPricePrediction({ crop, location, state });
    return ok(res, {
      crop,
      location,
      state,
      ...result
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  pricePrediction
};
