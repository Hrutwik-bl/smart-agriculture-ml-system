/**
 * weatherAlertsService.js
 *
 * Derives weather-based alerts for paddy farming from the latest
 * OpenWeatherMap snapshot. Saves snapshot to MongoDB as a side effect.
 */

const { fetchAndSaveWeather, getLatestWeather } = require("./weatherService");
const { OPENWEATHER_API_KEY } = require("../config");
const { ApiError } = require("../utils/errors");

const buildAlerts = (snapshot) => {
  const alerts = [];

  const rain  = snapshot.rainfall24h ?? 0;
  const temp  = snapshot.temperature ?? 0;
  const wind  = snapshot.windSpeed   ?? 0;

  if (rain >= 20) {
    alerts.push({ type: "HEAVY_RAIN",   severity: "HIGH",   message: `Heavy rainfall: ${rain} mm expected in 24 h. Delay irrigation.` });
  } else if (rain >= 5) {
    alerts.push({ type: "LIGHT_RAIN",   severity: "LOW",    message: `Light rainfall: ${rain} mm expected. Check if irrigation is still needed.` });
  }

  if (temp >= 38) {
    alerts.push({ type: "HIGH_TEMP",    severity: "MEDIUM", message: `High temperature: ${temp}°C. Risk of heat stress on paddy.` });
  }

  if (wind >= 12) {
    alerts.push({ type: "STRONG_WINDS", severity: "MEDIUM", message: `Strong winds: ${wind} m/s. Avoid spraying/application.` });
  }

  if (alerts.length === 0) {
    alerts.push({ type: "CLEAR",        severity: "LOW",    message: "No severe weather alerts. Conditions are favourable for paddy." });
  }

  return alerts;
};

const getWeatherAlerts = async (location) => {
  if (!location) {
    throw new ApiError("location is required", 400, "LOCATION_REQUIRED");
  }

  let snapshot;
  if (OPENWEATHER_API_KEY) {
    snapshot = await fetchAndSaveWeather(location);
  } else {
    // Try cached snapshot from MongoDB
    snapshot = await getLatestWeather();
    if (!snapshot) {
      throw new ApiError(
        "OpenWeatherMap API key not configured and no cached weather data available.",
        503,
        "WEATHER_UNAVAILABLE"
      );
    }
  }

  return {
    location:  snapshot.location,
    timestamp: snapshot.timestamp,
    weather: {
      temperature: snapshot.temperature,
      humidity:    snapshot.humidity,
      condition:   snapshot.condition,
      rainfall24h: snapshot.rainfall24h,
      windSpeed:   snapshot.windSpeed,
    },
    alerts: buildAlerts(snapshot),
  };
};

module.exports = { getWeatherAlerts };
