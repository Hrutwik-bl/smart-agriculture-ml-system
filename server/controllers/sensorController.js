/**
 * sensorController.js
 *
 * GET  /api/sensor/latest   — return latest reading from MongoDB
 * POST /api/sensor/ingest   — accept ESP32 data from Raspberry Pi
 */

const { ingestSensorData, getLatestSensorData } = require("../services/sensorService");
const { ok }   = require("../utils/response");
const { DEVICE_SECRET } = require("../config");

/**
 * Middleware: validate the X-Device-Secret header on ingest routes.
 * If DEVICE_SECRET env is the default placeholder, skip check in dev.
 */
const verifyDeviceSecret = (req, res, next) => {
  const secret = req.headers["x-device-secret"] || req.body?.deviceSecret;
  if (secret !== DEVICE_SECRET) {
    return res.status(401).json({
      success: false,
      error: { message: "Invalid or missing device secret", code: "UNAUTHORIZED_DEVICE" },
    });
  }
  return next();
};

/** POST /api/sensor/ingest */
const ingestSensor = async (req, res, next) => {
  try {
    const data = await ingestSensorData(req.body);
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

/** GET /api/sensor/latest */
const getLiveMonitoring = async (req, res, next) => {
  try {
    const data = await getLatestSensorData();
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

module.exports = { ingestSensor, getLiveMonitoring, verifyDeviceSecret };
