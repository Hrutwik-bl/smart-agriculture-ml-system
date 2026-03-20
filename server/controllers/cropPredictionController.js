const { getCropRecommendations } = require("../services/cropPredictionService");
const { ok } = require("../utils/response");
const { ApiError } = require("../utils/errors");

const buildSoil = (body, query) => {
  const soil = body.soil || {};
  return {
    n: soil.n ?? body.n ?? query.n,
    p: soil.p ?? body.p ?? query.p,
    k: soil.k ?? body.k ?? query.k,
    ph: soil.ph ?? body.ph ?? query.ph,
    temperature: soil.temperature ?? body.temperature ?? query.temperature,
    humidity: soil.humidity ?? body.humidity ?? query.humidity,
    rainfall: soil.rainfall ?? body.rainfall ?? query.rainfall
  };
};

const cropPrediction = async (req, res, next) => {
  try {
    const location = String(req.body.location || req.query.location || "").trim();
    const season = String(req.body.season || req.query.season || "").trim();
    if (!location) {
      throw new ApiError("location is required", 400, "LOCATION_REQUIRED");
    }
    const soil = buildSoil(req.body, req.query);
    const result = await getCropRecommendations({ location, season, soil });
    return ok(res, {
      location,
      season,
      recommendations: result.recommendations,
      source: result.source,
      warning: result.warning || null
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  cropPrediction
};
