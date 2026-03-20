const { getIrrigationPlan } = require("../services/irrigationService");
const { ok } = require("../utils/response");

const irrigationPlan = async (req, res, next) => {
  try {
    const location = req.body.location || req.query.location || "";
    const lat = req.body.lat ?? req.query.lat;
    const lon = req.body.lon ?? req.query.lon;
    const plan = await getIrrigationPlan({ location, lat, lon });
    return ok(res, plan);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  irrigationPlan
};
