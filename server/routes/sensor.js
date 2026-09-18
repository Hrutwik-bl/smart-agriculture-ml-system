const express = require("express");
const { ingestSensor, getLiveMonitoring, verifyDeviceSecret } = require("../controllers/sensorController");

const router = express.Router();

// Raspberry Pi POSTs ESP32 data here — requires X-Device-Secret header
router.post("/sensor/ingest", verifyDeviceSecret, ingestSensor);

// Dashboard polls this for the latest sensor reading
router.get("/sensor/latest", getLiveMonitoring);

// Legacy alias (kept for backward compat)
router.get("/monitoring", getLiveMonitoring);

module.exports = router;
