const express = require("express");
const { irrigationPlan } = require("../controllers/irrigationController");

const router = express.Router();

router.post("/irrigation", irrigationPlan);
router.get("/irrigation", irrigationPlan);

module.exports = router;
