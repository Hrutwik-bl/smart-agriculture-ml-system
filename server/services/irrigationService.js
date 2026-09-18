/**
 * irrigationService.js
 *
 * Decides whether to irrigate and how much water is required.
 *
 * Decision flow:
 *   1. Read latest sensor data from MongoDB (or accept live payload)
 *   2. Read latest weather snapshot from MongoDB
 *   3. Call ML service (Random Forest + SVR) for irrigation decision
 *   4. If ML service unavailable → rule-based fallback
 *   5. Save AI decision to MongoDB
 *   6. Return decision object
 */

const { getCollection, COLLECTIONS } = require("./db");
const { getLatestWeather }           = require("./weatherService");
const { getLatestSensorData }        = require("./sensorService");
const { mlAvailable, predictIrrigation } = require("./pythonMlService");
const { PADDY_SOIL_MOISTURE_LOW, PADDY_SOIL_MOISTURE_HIGH } = require("../config");

// ─── Rule-based fallback ──────────────────────────────────────────────────────

/**
 * Simple paddy-specific heuristic when ML service is down.
 * Based on: soil moisture, air temperature, humidity, expected rainfall.
 */
const ruleBasedIrrigation = ({ soilMoisture, temperature, humidity, rainfall24h }) => {
  const moisture   = soilMoisture ?? 50;
  const temp       = temperature  ?? 28;
  const hum        = humidity     ?? 70;
  const rain       = rainfall24h  ?? 0;

  // Don't irrigate if enough rain expected or soil is already wet
  if (rain >= 10)                          return { irrigate: false, reason: "Sufficient rainfall expected (≥10 mm in 24 h)" };
  if (moisture >= PADDY_SOIL_MOISTURE_HIGH) return { irrigate: false, reason: "Soil moisture is in the optimal range" };

  // Estimate ET-based water requirement (Penman–Monteith simplified)
  const base         = 4.0;
  const tempFactor   = Math.max(0, (temp  - 25) * 0.18);
  const humFactor    = Math.max(0, (50    - hum) * 0.02);
  const rainOffset   = Math.min(4, rain / 10);
  const requirement  = Math.max(0.5, base + tempFactor + humFactor - rainOffset);

  const irrigate = moisture < PADDY_SOIL_MOISTURE_LOW;

  let reason;
  if (!irrigate) {
    reason = "Soil moisture is acceptable — monitor and irrigate if it drops further";
  } else {
    reason = `Soil moisture (${moisture}%) is below threshold (${PADDY_SOIL_MOISTURE_LOW}%)`;
  }

  return {
    irrigate,
    waterRequirementMm: Number(requirement.toFixed(2)),
    reason,
  };
};

// ─── Irrigation duration estimate ─────────────────────────────────────────────

/**
 * Translate water requirement (mm/day) to pump runtime in minutes.
 * Assumes a standard small-plot DC pump flow rate of ~6 L/min over 2 m² test field.
 * Adjust FLOW_RATE_MM_PER_MIN to match your actual pump + field dimensions.
 */
const FLOW_RATE_MM_PER_MIN = 0.5; // mm of water depth per minute
const estimateDurationMin = (requirementMm) => {
  if (!requirementMm || requirementMm <= 0) return 0;
  return Math.ceil(requirementMm / FLOW_RATE_MM_PER_MIN);
};

// ─── Main service function ────────────────────────────────────────────────────

/**
 * Compute and save an irrigation decision.
 *
 * @param {object} options
 *   sensorOverride  — raw sensor values (used when called directly after ingest)
 *   weatherOverride — raw weather values (used when weather was just fetched)
 *
 * If not provided, the latest records from MongoDB are used.
 */
const getIrrigationDecision = async ({ sensorOverride = null, weatherOverride = null } = {}) => {
  // 1. Gather sensor values
  let sensorDoc = sensorOverride;
  if (!sensorDoc) {
    const latest = await getLatestSensorData();
    sensorDoc = {
      soilMoisture: latest.soilMoisture?.value,
      temperature:  latest.temperature?.value,
      humidity:     latest.humidity?.value,
      nitrogen:     latest.nitrogen?.value,
      phosphorus:   latest.phosphorus?.value,
      potassium:    latest.potassium?.value,
    };
  }

  // 2. Gather weather values
  let weatherDoc = weatherOverride;
  if (!weatherDoc) {
    const wx = await getLatestWeather();
    weatherDoc = {
      rainfall24h: wx?.rainfall24h ?? 0,
      temperature: wx?.temperature ?? sensorDoc.temperature,
      humidity:    wx?.humidity    ?? sensorDoc.humidity,
    };
  }

  const inputPayload = {
    soilMoisture: sensorDoc.soilMoisture,
    temperature:  sensorDoc.temperature ?? weatherDoc.temperature,
    humidity:     sensorDoc.humidity    ?? weatherDoc.humidity,
    nitrogen:     sensorDoc.nitrogen,
    phosphorus:   sensorDoc.phosphorus,
    potassium:    sensorDoc.potassium,
    rainfall24h:  weatherDoc.rainfall24h ?? 0,
  };

  // 3. Try ML service
  let decision;
  let modelUsed = "rule-based";

  if (mlAvailable()) {
    try {
      const mlResult = await predictIrrigation(inputPayload);
      decision  = {
        irrigate:           Boolean(mlResult.irrigate),
        waterRequirementMm: mlResult.waterRequirementMm ?? null,
        confidence:         mlResult.confidence ?? null,
        reason:             mlResult.reason ?? (mlResult.irrigate ? "ML model recommends irrigation" : "ML model: no irrigation needed"),
      };
      modelUsed = mlResult.model || "ml-irrigation";
    } catch (mlErr) {
      console.warn("[irrigationService] ML call failed, using rule-based fallback:", mlErr.message);
      decision = ruleBasedIrrigation(inputPayload);
    }
  } else {
    decision = ruleBasedIrrigation(inputPayload);
  }

  const durationMin = estimateDurationMin(decision.waterRequirementMm);

  const result = {
    timestamp:          new Date(),
    model:              modelUsed,
    input:              inputPayload,
    irrigate:           decision.irrigate,
    waterRequirementMm: decision.waterRequirementMm ?? null,
    durationMinutes:    durationMin,
    confidence:         decision.confidence ?? null,
    reason:             decision.reason,
    recommendation:     decision.irrigate
      ? `Irrigate for approximately ${durationMin} minutes (${decision.waterRequirementMm ?? "?"} mm required)`
      : decision.reason,
  };

  // 4. Save AI decision to MongoDB
  const col = getCollection(COLLECTIONS.AI_DECISIONS);
  if (col) {
    await col.insertOne({ type: "IRRIGATION", ...result });
  }

  return result;
};

/**
 * Return the latest saved irrigation decision from MongoDB.
 */
const getLatestIrrigationDecision = async () => {
  const col = getCollection(COLLECTIONS.AI_DECISIONS);
  if (!col) return null;
  const docs = await col
    .find({ type: "IRRIGATION" })
    .sort({ timestamp: -1 })
    .limit(1)
    .toArray();
  return docs[0] || null;
};

module.exports = {
  getIrrigationDecision,
  getLatestIrrigationDecision,
  ruleBasedIrrigation,
};
