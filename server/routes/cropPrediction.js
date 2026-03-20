const express = require("express");
const { cropPrediction } = require("../controllers/cropPredictionController");

const router = express.Router();

router.post("/crop-prediction", cropPrediction);
router.get("/crop-prediction", cropPrediction);

module.exports = router;
