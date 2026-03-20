const { getSoilHealth } = require("../services/soilHealthService");
const { ok } = require("../utils/response");

const soilHealth = async (req, res, next) => {
  try {
    const location = String(req.body.location || req.query.location || "").trim();
    const soil = req.body.soil || {
      n: req.body.n,
      p: req.body.p,
      k: req.body.k,
      ph: req.body.ph
    };
    const result = await getSoilHealth({ location, soil });
    return ok(res, result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  soilHealth
};
