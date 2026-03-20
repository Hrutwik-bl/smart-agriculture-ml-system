const express = require("express");
const cropRoutes = require("./cropPrediction");
const irrigationRoutes = require("./irrigation");
const weatherRoutes = require("./weatherAlerts");
const soilRoutes = require("./soilHealth");
const priceRoutes = require("./pricePrediction");
const marketRoutes = require("./marketTrends");

const router = express.Router();

router.use(cropRoutes);
router.use(irrigationRoutes);
router.use(weatherRoutes);
router.use(soilRoutes);
router.use(priceRoutes);
router.use(marketRoutes);

module.exports = router;
