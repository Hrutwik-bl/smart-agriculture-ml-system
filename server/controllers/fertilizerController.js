/**
 * fertilizerController.js
 *
 * GET  /api/fertilizer          — return latest saved fertilizer recommendation
 * POST /api/fertilizer/predict  — trigger a new ML/rule-based recommendation now
 */

const { getFertilizerRecommendation, getLatestFertilizerRecommendation } = require("../services/fertilizerService");
const { ok } = require("../utils/response");

/** GET /api/fertilizer — latest stored recommendation */
const getLatestRecommendation = async (req, res, next) => {
  try {
    const data = await getLatestFertilizerRecommendation();
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

/** POST /api/fertilizer/predict — compute a fresh recommendation */
const fertilizerPredict = async (req, res, next) => {
  try {
    const sensorOverride = req.body.sensor || null;
    const data = await getFertilizerRecommendation({ sensorOverride });
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getLatestRecommendation, fertilizerPredict };
