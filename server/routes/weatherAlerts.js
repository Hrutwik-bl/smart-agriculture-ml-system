const express = require("express");
const { weatherAlerts } = require("../controllers/weatherAlertsController");

const router = express.Router();

router.get("/weather-alerts", weatherAlerts);
router.post("/weather-alerts", weatherAlerts);

module.exports = router;
