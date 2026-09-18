const express = require("express");
const { getCropData } = require("../controllers/cropController");

const router = express.Router();

router.get("/crop", getCropData);
router.post("/crop", getCropData);

module.exports = router;
