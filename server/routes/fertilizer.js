const express = require("express");
const { getLatestRecommendation, fertilizerPredict } = require("../controllers/fertilizerController");

const router = express.Router();

// GET latest stored recommendation
router.get("/fertilizer", getLatestRecommendation);

// POST triggers a fresh ML/rule-based recommendation
router.post("/fertilizer/predict", fertilizerPredict);

// Legacy alias
router.post("/fertilizer", fertilizerPredict);

module.exports = router;
