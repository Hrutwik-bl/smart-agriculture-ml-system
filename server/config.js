const path = require("path");

const env = (key, fallback = "") => (process.env[key] ? String(process.env[key]) : fallback);
const envBool = (key, fallback = false) => {
  if (!process.env[key]) return fallback;
  return String(process.env[key]).toLowerCase() === "true";
};

const ROOT = path.join(__dirname, "..");

module.exports = {
  ROOT,
  PORT: Number(env("PORT", "5000")),
  MONGODB_URI: env("MONGODB_URI"),
  OPENWEATHER_API_KEY: env("OPENWEATHER_API_KEY"),
  DATA_GOV_API_KEY: env("DATA_GOV_API_KEY"),
  SOIL_HEALTH_API_KEY: env("SOIL_HEALTH_API_KEY"),
  ML_SERVICE_URL: env("ML_SERVICE_URL"),
  ML_SERVICE_PREDICT_PATH: env("ML_SERVICE_PREDICT_PATH", "/crop-prediction"),
  DEMO_MODE: envBool("DEMO_MODE", true),
  AGMARKNET_API_BASE: env("AGMARKNET_API_BASE", "https://api.data.gov.in/resource"),
  AGMARKNET_RESOURCE_ID: env("AGMARKNET_RESOURCE_ID"),
  SOIL_HEALTH_RESOURCE_ID: env("SOIL_HEALTH_RESOURCE_ID"),
  NASA_POWER_BASE: env("NASA_POWER_BASE", "https://power.larc.nasa.gov/api/temporal"),
  SOIL_HEALTH_CSV_PATH: env("SOIL_HEALTH_CSV_PATH", path.join(ROOT, "data", "soil_health.csv")),
  CROP_PRICE_CSV_PATH: env("CROP_PRICE_CSV_PATH", path.join(ROOT, "data", "agmarknet_prices.csv")),
  CROP_RECOMMENDATION_CSV_PATH: env(
    "CROP_RECOMMENDATION_CSV_PATH",
    path.join(ROOT, "data", "crop_recommendation.csv")
  )
};
