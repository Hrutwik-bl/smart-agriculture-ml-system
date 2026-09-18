const express = require("express");
const { getHistory } = require("../controllers/historyController");

const router = express.Router();

router.get("/history", getHistory);

module.exports = router;
