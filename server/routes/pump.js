const express = require("express");
const { pumpStatus, pumpControl, pumpHistory } = require("../controllers/pumpController");

const router = express.Router();

// Raspberry Pi polls this to know what to do with the relay
router.get("/pump/status", pumpStatus);

// Dashboard / AI sends ON or OFF command
router.post("/pump/control", pumpControl);

// History view
router.get("/pump/history", pumpHistory);

module.exports = router;
