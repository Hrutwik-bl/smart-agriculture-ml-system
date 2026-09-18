const path = require("path");

const env = (key, fallback = "") =>
  process.env[key] ? String(process.env[key]) : fallback;

const envBool = (key, fallback = false) => {
  if (!process.env[key]) return fallback;
  return String(process.env[key]).toLowerCase() === "true";
};

const envNum = (key, fallback) => {
  const val = process.env[key];
  const parsed = Number(val);
  return val && Number.isFinite(parsed) ? parsed : fallback;
};

const ROOT = path.join(__dirname, "..");

module.exports = {
  ROOT,

  // Server
  PORT: envNum("PORT", 5000),
  SESSION_SECRET: env("SESSION_SECRET", "smart-agri-dev-secret-change-in-prod"),

  // MongoDB
  MONGODB_URI: env("MONGODB_URI"),

  // OpenWeatherMap
  OPENWEATHER_API_KEY: env("OPENWEATHER_API_KEY"),

  // ML service (Python/FastAPI)
  ML_SERVICE_URL: env("ML_SERVICE_URL", "http://127.0.0.1:8000"),
  ML_SERVICE_PREDICT_PATH: env("ML_SERVICE_PREDICT_PATH", "/predict-crop"),
  ML_IRRIGATION_PATH: env("ML_IRRIGATION_PATH", "/predict-irrigation"),
  ML_FERTILIZER_PATH: env("ML_FERTILIZER_PATH", "/predict-fertilizer"),

  // Dataset paths (optional CSV fallbacks)
  CROP_RECOMMENDATION_CSV_PATH: env("CROP_RECOMMENDATION_CSV_PATH"),
  SOIL_HEALTH_CSV_PATH: env("SOIL_HEALTH_CSV_PATH"),
  CROP_PRICE_CSV_PATH: env("CROP_PRICE_CSV_PATH"),

  // Demo/prototype mode
  DEMO_MODE: envBool("DEMO_MODE", false),

  // Sensor ingest shared secret (ESP32 / Raspberry Pi must send this in X-Device-Secret header)
  DEVICE_SECRET: env("DEVICE_SECRET", "iot-device-secret-change-in-prod"),

  // Paddy thresholds for rule-based decisions
  PADDY_SOIL_MOISTURE_LOW: envNum("PADDY_SOIL_MOISTURE_LOW", 40),  // % — irrigate below this
  PADDY_SOIL_MOISTURE_HIGH: envNum("PADDY_SOIL_MOISTURE_HIGH", 70), // % — stop irrigation above this
};
