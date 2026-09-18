/**
 * pumpController.js
 *
 * GET  /api/pump/status   — current pump state (polled by Raspberry Pi)
 * POST /api/pump/control  — send ON/OFF command (from dashboard or AI)
 * GET  /api/pump/history  — last N pump events
 */

const { controlPump, getPumpStatus, getPumpHistory } = require("../services/pumpService");
const { ok } = require("../utils/response");

/** GET /api/pump/status */
const pumpStatus = async (req, res, next) => {
  try {
    const data = await getPumpStatus();
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

/** POST /api/pump/control  body: { command: "ON"|"OFF", reason?, durationMinutes? } */
const pumpControl = async (req, res, next) => {
  try {
    const { command, reason, durationMinutes } = req.body;
    const triggeredBy = req.session?.username ? `user:${req.session.username}` : "api";
    const data = await controlPump({ command, triggeredBy, reason, durationMinutes });
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

/** GET /api/pump/history?limit=20 */
const pumpHistory = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
    const data  = await getPumpHistory(limit);
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

module.exports = { pumpStatus, pumpControl, pumpHistory };
