/**
 * irrigationController.js
 *
 * GET  /api/irrigation          — return latest saved irrigation decision
 * POST /api/irrigation/predict  — trigger a new ML/rule-based decision now
 */

const { getIrrigationDecision, getLatestIrrigationDecision } = require("../services/irrigationService");
const { ok } = require("../utils/response");

/** GET /api/irrigation — latest stored decision */
const getLatestDecision = async (req, res, next) => {
  try {
    const data = await getLatestIrrigationDecision();
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

/** POST /api/irrigation/predict — compute a fresh decision */
const irrigationPredict = async (req, res, next) => {
  try {
    // Caller may optionally supply sensor/weather overrides in the body
    const sensorOverride  = req.body.sensor  || null;
    const weatherOverride = req.body.weather || null;
    const data = await getIrrigationDecision({ sensorOverride, weatherOverride });
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getLatestDecision, irrigationPredict };
