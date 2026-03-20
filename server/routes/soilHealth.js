const express = require("express");
const { soilHealth } = require("../controllers/soilHealthController");

const router = express.Router();

router.post("/soil-health", soilHealth);
router.get("/soil-health", soilHealth);

module.exports = router;
