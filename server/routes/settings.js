const express = require("express");
const { getSettingsData, updateSettingsData } = require("../controllers/settingsController");

const router = express.Router();

router.get("/settings",  getSettingsData);
router.post("/settings", updateSettingsData);

module.exports = router;
