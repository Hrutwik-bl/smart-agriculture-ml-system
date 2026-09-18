const { getCropInfo } = require("../services/cropService");
const { ok } = require("../utils/response");

const getCropData = async (req, res, next) => {
  try {
    const data = await getCropInfo();
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCropData
};
