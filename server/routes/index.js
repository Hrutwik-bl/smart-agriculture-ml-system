const express = require("express");

const sensorRoutes       = require("./sensor");
const irrigationRoutes   = require("./irrigation");
const fertilizerRoutes   = require("./fertilizer");
const pumpRoutes         = require("./pump");
const dashboardRoutes    = require("./dashboard");
const historyRoutes      = require("./history");
const alertsRoutes       = require("./alerts");
const settingsRoutes     = require("./settings");
const weatherAlertsRoutes = require("./weatherAlerts");

const router = express.Router();

// IoT data pipeline
router.use(sensorRoutes);         // POST /sensor/ingest, GET /sensor/latest
router.use(irrigationRoutes);     // GET  /irrigation,   POST /irrigation/predict
router.use(fertilizerRoutes);     // GET  /fertilizer,   POST /fertilizer/predict
router.use(pumpRoutes);           // GET  /pump/status,  POST /pump/control, GET /pump/history

// Dashboard and analytics
router.use(dashboardRoutes);      // GET  /dashboard
router.use(historyRoutes);        // GET  /history
router.use(alertsRoutes);         // GET  /alerts
router.use(settingsRoutes);       // GET  /settings, POST /settings
router.use(weatherAlertsRoutes);  // GET  /weather-alerts?location=...

module.exports = router;
