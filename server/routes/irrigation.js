const express = require("express");
const { getLatestDecision, irrigationPredict } = require("../controllers/irrigationController");

const router = express.Router();

// GET latest stored decision
router.get("/irrigation", getLatestDecision);

// POST triggers a fresh ML/rule-based prediction
router.post("/irrigation/predict", irrigationPredict);

// Legacy alias
router.post("/irrigation", irrigationPredict);

module.exports = router;
