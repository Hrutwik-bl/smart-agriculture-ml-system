const { getSettings, updateSettings } = require("../services/settingsService");
const { ok } = require("../utils/response");

const getSettingsData = async (req, res, next) => {
  try {
    // Use session username — NOT userId (which was never set)
    const username = req.session?.username || null;
    const data = await getSettings(username);
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

const updateSettingsData = async (req, res, next) => {
  try {
    const username = req.session?.username || null;
    const updates  = req.body;
    const data = await updateSettings(username, updates);
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getSettingsData, updateSettingsData };
