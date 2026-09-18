const express = require("express");
const { getAllAlerts } = require("../controllers/alertsController");

const router = express.Router();

router.get("/alerts", getAllAlerts);

module.exports = router;
