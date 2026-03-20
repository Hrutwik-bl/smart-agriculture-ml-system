const express = require("express");
const { marketTrends } = require("../controllers/marketTrendsController");

const router = express.Router();

router.post("/market-trends", marketTrends);
router.get("/market-trends", marketTrends);

module.exports = router;
