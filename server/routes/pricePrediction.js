const express = require("express");
const { pricePrediction } = require("../controllers/pricePredictionController");

const router = express.Router();

router.post("/price-prediction", pricePrediction);
router.get("/price-prediction", pricePrediction);

module.exports = router;
