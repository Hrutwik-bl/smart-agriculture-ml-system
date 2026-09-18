/**
 * dashboardService.js
 *
 * Aggregates the latest data from all sources into a single
 * dashboard snapshot. Everything is read from MongoDB — no hardcoded values.
 */

const { getLatestSensorData }              = require("./sensorService");
const { getLatestWeather }                 = require("./weatherService");
const { getLatestIrrigationDecision }      = require("./irrigationService");
const { getLatestFertilizerRecommendation } = require("./fertilizerService");
const { getPumpStatus }                    = require("./pumpService");

const getDashboardData = async () => {
  // Fetch all sources in parallel
  const [sensor, weather, irrigation, fertilizer, pump] = await Promise.all([
    getLatestSensorData().catch(() => null),
    getLatestWeather().catch(() => null),
    getLatestIrrigationDecision().catch(() => null),
    getLatestFertilizerRecommendation().catch(() => null),
    getPumpStatus().catch(() => null),
  ]);

  // Build compact sensor snapshot
  const sensorSnapshot = sensor
    ? {
        soilMoisture: sensor.soilMoisture,
        temperature:  sensor.temperature,
        humidity:     sensor.humidity,
        nitrogen:     sensor.nitrogen,
        phosphorus:   sensor.phosphorus,
        potassium:    sensor.potassium,
        deviceId:     sensor.deviceId,
        lastSync:     sensor.timestamp,
        source:       sensor.source,
      }
    : null;

  // Build compact weather snapshot
  const weatherSnapshot = weather
    ? {
        location:    weather.location,
        temperature: weather.temperature,
        humidity:    weather.humidity,
        condition:   weather.condition,
        rainfall24h: weather.rainfall24h,
        windSpeed:   weather.windSpeed,
        timestamp:   weather.timestamp,
      }
    : null;

  // Build irrigation summary
  const irrigationSummary = irrigation
    ? {
        irrigate:           irrigation.irrigate,
        waterRequirementMm: irrigation.waterRequirementMm,
        durationMinutes:    irrigation.durationMinutes,
        recommendation:     irrigation.recommendation,
        confidence:         irrigation.confidence,
        model:              irrigation.model,
        timestamp:          irrigation.timestamp,
      }
    : null;

  // Build fertilizer summary
  const fertilizerSummary = fertilizer
    ? {
        actionRequired:  fertilizer.actionRequired,
        priority:        fertilizer.priority,
        summary:         fertilizer.summary,
        npkStatus:       fertilizer.npkStatus,
        applications:    fertilizer.applications,
        model:           fertilizer.model,
        timestamp:       fertilizer.timestamp,
      }
    : null;

  // Derive active alerts from live data
  const alerts = _deriveAlerts(sensor, weather, irrigation, fertilizer);

  return {
    timestamp:    new Date(),
    field: {
      crop:       "Paddy (Rice)",
      growthStage: "Vegetative",        // TODO: track from settings
    },
    sensor:       sensorSnapshot,
    weather:      weatherSnapshot,
    irrigation:   irrigationSummary,
    fertilizer:   fertilizerSummary,
    pump:         pump,
    alerts,
    alertCount:   alerts.length,
    criticalCount: alerts.filter((a) => a.severity === "HIGH").length,
  };
};

// ─── Alert derivation ─────────────────────────────────────────────────────────

const _deriveAlerts = (sensor, weather, irrigation, fertilizer) => {
  const alerts = [];
  const now    = new Date();

  if (sensor) {
    const sm = sensor.soilMoisture?.value;
    if (sm !== null && sm !== undefined) {
      if (sm < 40) {
        alerts.push({
          id:       "SOIL_MOISTURE_LOW",
          type:     "SOIL_MOISTURE",
          severity: "HIGH",
          title:    "Low Soil Moisture",
          message:  `Soil moisture is ${sm}% — below the 40% threshold. Irrigation recommended.`,
          action:   "IRRIGATE",
          time:     now,
        });
      } else if (sm > 80) {
        alerts.push({
          id:       "SOIL_MOISTURE_HIGH",
          type:     "SOIL_MOISTURE",
          severity: "MEDIUM",
          title:    "High Soil Moisture",
          message:  `Soil moisture is ${sm}% — above 80%. Check for waterlogging.`,
          action:   "MONITOR",
          time:     now,
        });
      }
    }

    // NPK alerts
    const npkChecks = [
      { key: "nitrogen",   label: "Nitrogen",   rec: "Apply Urea (46-0-0)" },
      { key: "phosphorus", label: "Phosphorus", rec: "Apply DAP or SSP" },
      { key: "potassium",  label: "Potassium",  rec: "Apply MOP (0-0-60)" },
    ];
    for (const { key, label, rec } of npkChecks) {
      if (sensor[key]?.status === "LOW") {
        alerts.push({
          id:       `${key.toUpperCase()}_LOW`,
          type:     "NUTRIENT_DEFICIENCY",
          severity: "HIGH",
          title:    `${label} Deficiency`,
          message:  `${label} is LOW (${sensor[key].value} ${sensor[key].unit}). ${rec} within 3–5 days.`,
          action:   "APPLY_FERTILIZER",
          time:     now,
        });
      }
    }
  }

  if (weather) {
    if (weather.rainfall24h >= 10) {
      alerts.push({
        id:       "HEAVY_RAIN_EXPECTED",
        type:     "WEATHER",
        severity: "MEDIUM",
        title:    "Heavy Rain Expected",
        message:  `${weather.rainfall24h} mm of rainfall expected in the next 24 h. Delay irrigation.`,
        action:   "DELAY_IRRIGATION",
        time:     now,
      });
    }
    if ((weather.temperature ?? 0) >= 38) {
      alerts.push({
        id:       "HIGH_TEMP",
        type:     "WEATHER",
        severity: "MEDIUM",
        title:    "High Temperature Alert",
        message:  `Temperature is ${weather.temperature}°C. Monitor for heat stress.`,
        action:   "MONITOR",
        time:     now,
      });
    }
  }

  return alerts;
};

module.exports = { getDashboardData };
