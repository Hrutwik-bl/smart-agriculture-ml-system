/**
 * alertsService.js
 *
 * Derives active alerts from the latest sensor, weather,
 * irrigation, and fertilizer data — all sourced from MongoDB.
 * No hardcoded values.
 */

const { getLatestSensorData }               = require("./sensorService");
const { getLatestWeather }                  = require("./weatherService");
const { getLatestIrrigationDecision }       = require("./irrigationService");
const { getLatestFertilizerRecommendation } = require("./fertilizerService");

const getAlerts = async () => {
  const [sensor, weather, irrigation, fertilizer] = await Promise.all([
    getLatestSensorData().catch(() => null),
    getLatestWeather().catch(() => null),
    getLatestIrrigationDecision().catch(() => null),
    getLatestFertilizerRecommendation().catch(() => null),
  ]);

  const alerts = [];
  let idCounter = 1;
  const now = new Date();

  const push = (type, severity, title, message, action) => {
    alerts.push({ id: idCounter++, type, severity, title, message, action, time: now });
  };

  // ── Soil moisture ────────────────────────────────────────────────────────────
  if (sensor?.soilMoisture?.value != null) {
    const sm = sensor.soilMoisture.value;
    if (sm < 40) {
      push("SOIL_MOISTURE", "HIGH",
        "Low Soil Moisture",
        `Soil moisture is ${sm}% — below the 40% threshold. Irrigation is required.`,
        "IRRIGATE");
    } else if (sm > 80) {
      push("SOIL_MOISTURE", "MEDIUM",
        "High Soil Moisture",
        `Soil moisture is ${sm}% — above 80%. Risk of waterlogging.`,
        "MONITOR");
    }
  }

  // ── Temperature ──────────────────────────────────────────────────────────────
  if (sensor?.temperature?.value != null) {
    const t = sensor.temperature.value;
    if (t >= 38) {
      push("TEMPERATURE", "MEDIUM",
        "High Field Temperature",
        `Air temperature is ${t}°C. Consider increasing irrigation frequency to reduce heat stress.`,
        "IRRIGATE");
    }
  }

  // ── NPK deficiency ───────────────────────────────────────────────────────────
  const npkChecks = [
    { key: "nitrogen",   label: "Nitrogen",   rec: "Apply Urea (46-0-0)" },
    { key: "phosphorus", label: "Phosphorus", rec: "Apply DAP or SSP" },
    { key: "potassium",  label: "Potassium",  rec: "Apply MOP (0-0-60)" },
  ];
  for (const { key, label, rec } of npkChecks) {
    const field = sensor?.[key];
    if (field?.status === "LOW") {
      push("NUTRIENT_DEFICIENCY", "HIGH",
        `${label} Deficiency`,
        `${label} is LOW (${field.value} ${field.unit}). ${rec} within 3–5 days.`,
        "APPLY_FERTILIZER");
    } else if (field?.status === "HIGH") {
      push("NUTRIENT_EXCESS", "LOW",
        `${label} Excess`,
        `${label} is HIGH (${field.value} ${field.unit}). Reduce application rate.`,
        "MONITOR");
    }
  }

  // ── Weather alerts ───────────────────────────────────────────────────────────
  if (weather?.rainfall24h != null && weather.rainfall24h >= 10) {
    push("WEATHER", "MEDIUM",
      "Heavy Rainfall Expected",
      `${weather.rainfall24h} mm of rain expected in the next 24 h. Delay irrigation to avoid waterlogging.`,
      "DELAY_IRRIGATION");
  }
  if ((weather?.temperature ?? 0) >= 38) {
    push("WEATHER", "MEDIUM",
      "High Temperature Alert",
      `Forecast temperature is ${weather.temperature}°C. Monitor crop for heat stress.`,
      "MONITOR");
  }
  if ((weather?.windSpeed ?? 0) >= 12) {
    push("WEATHER", "LOW",
      "Strong Winds",
      `Wind speed is ${weather.windSpeed} m/s. Delay pesticide/fertilizer application.`,
      "MONITOR");
  }

  // ── Irrigation AI decision ───────────────────────────────────────────────────
  if (irrigation?.irrigate === true) {
    push("IRRIGATION", "HIGH",
      "Irrigation Required",
      irrigation.recommendation || "AI recommends irrigation based on current sensor and weather data.",
      "IRRIGATE");
  }

  // ── Fertilizer AI decision ───────────────────────────────────────────────────
  if (fertilizer?.actionRequired === true && fertilizer?.priority === "HIGH") {
    push("FERTILIZER", "HIGH",
      "Fertilizer Application Needed",
      fertilizer.summary || "NPK deficiency detected. Fertilizer application required.",
      "APPLY_FERTILIZER");
  }

  return {
    timestamp:     now,
    alerts,
    activeCount:   alerts.length,
    criticalCount: alerts.filter((a) => a.severity === "HIGH").length,
  };
};

module.exports = { getAlerts };
