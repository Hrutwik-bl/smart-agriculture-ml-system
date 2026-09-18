/**
 * fertilizerService.js
 *
 * NPK-based fertilizer recommendation for Paddy.
 *
 * Decision flow:
 *   1. Read latest sensor NPK values
 *   2. Call ML service (NPK model) for recommendation
 *   3. If ML unavailable → rule-based paddy NPK lookup table
 *   4. Save AI decision to MongoDB
 *   5. Return recommendation object
 */

const { getCollection, COLLECTIONS } = require("./db");
const { getLatestSensorData }        = require("./sensorService");
const { mlAvailable, predictFertilizer } = require("./pythonMlService");
const { RANGES }                     = require("./sensorService");

// ─── Paddy fertilizer lookup table (rule-based fallback) ──────────────────────

/**
 * Recommended fertilizer doses for paddy based on NPK status.
 * Dosages are indicative for a 1-hectare field — advise farmers to
 * confirm with local agricultural extension officers.
 */
const PADDY_FERTILIZER_RULES = {
  nitrogen: {
    LOW:    { product: "Urea (46-0-0)",          dosageKgPerHa: 50,  reason: "Nitrogen deficiency — yellowing leaves, stunted growth" },
    NORMAL: { product: null, dosageKgPerHa: 0,   reason: "Nitrogen level is adequate" },
    HIGH:   { product: null, dosageKgPerHa: 0,   reason: "Nitrogen sufficient — avoid over-application to prevent lodging" },
  },
  phosphorus: {
    LOW:    { product: "DAP (18-46-0) or SSP (0-16-0)", dosageKgPerHa: 30, reason: "Phosphorus deficiency — poor root development" },
    NORMAL: { product: null, dosageKgPerHa: 0,           reason: "Phosphorus level is adequate" },
    HIGH:   { product: null, dosageKgPerHa: 0,           reason: "Phosphorus sufficient" },
  },
  potassium: {
    LOW:    { product: "MOP / KCl (0-0-60)",     dosageKgPerHa: 40,  reason: "Potassium deficiency — brown leaf tips, weak stems" },
    NORMAL: { product: null, dosageKgPerHa: 0,   reason: "Potassium level is adequate" },
    HIGH:   { product: null, dosageKgPerHa: 0,   reason: "Potassium sufficient" },
  },
};

const classifyNpk = (value, range) => {
  if (value === null || value === undefined) return "UNKNOWN";
  if (value < range.low)  return "LOW";
  if (value > range.high) return "HIGH";
  return "NORMAL";
};

const ruleBasedFertilizer = ({ nitrogen, phosphorus, potassium }) => {
  const nStatus = classifyNpk(nitrogen,   RANGES.nitrogen);
  const pStatus = classifyNpk(phosphorus, RANGES.phosphorus);
  const kStatus = classifyNpk(potassium,  RANGES.potassium);

  const applications = [];

  const check = (nutrient, status, value) => {
    const rule = PADDY_FERTILIZER_RULES[nutrient][status];
    if (rule && rule.product) {
      applications.push({
        nutrient,
        status,
        measuredValue:  value,
        product:        rule.product,
        dosageKgPerHa:  rule.dosageKgPerHa,
        reason:         rule.reason,
      });
    }
  };

  check("nitrogen",   nStatus, nitrogen);
  check("phosphorus", pStatus, phosphorus);
  check("potassium",  kStatus, potassium);

  const priority = applications.length >= 2 ? "HIGH"
                 : applications.length === 1 ? "MEDIUM"
                 : "LOW";

  const summary = applications.length === 0
    ? "NPK levels are within the optimal range — no fertilizer application needed now"
    : `Apply: ${applications.map((a) => a.product).join(", ")} within 3–5 days`;

  return {
    npkStatus:    { nitrogen: nStatus, phosphorus: pStatus, potassium: kStatus },
    applications,
    priority,
    actionRequired: applications.length > 0,
    summary,
    nextCheckDays: 7,
  };
};

// ─── Main service function ────────────────────────────────────────────────────

const getFertilizerRecommendation = async ({ sensorOverride = null } = {}) => {
  // 1. Gather sensor NPK values
  let sensorDoc = sensorOverride;
  if (!sensorDoc) {
    const latest = await getLatestSensorData();
    sensorDoc = {
      nitrogen:    latest.nitrogen?.value,
      phosphorus:  latest.phosphorus?.value,
      potassium:   latest.potassium?.value,
      temperature: latest.temperature?.value,
      humidity:    latest.humidity?.value,
    };
  }

  const inputPayload = {
    nitrogen:    sensorDoc.nitrogen,
    phosphorus:  sensorDoc.phosphorus,
    potassium:   sensorDoc.potassium,
    temperature: sensorDoc.temperature,
    humidity:    sensorDoc.humidity,
  };

  // 2. Try ML service
  let recommendation;
  let modelUsed = "rule-based";

  if (mlAvailable()) {
    try {
      const mlResult = await predictFertilizer(inputPayload);
      recommendation = {
        npkStatus:      mlResult.npkStatus      ?? null,
        applications:   mlResult.fertilizers    ?? [],
        priority:       mlResult.priority       ?? "MEDIUM",
        actionRequired: mlResult.actionRequired ?? false,
        summary:        mlResult.recommendation ?? "See ML recommendation",
        confidence:     mlResult.confidence     ?? null,
        nextCheckDays:  7,
      };
      modelUsed = "ml-fertilizer";
    } catch (mlErr) {
      console.warn("[fertilizerService] ML call failed, using rule-based fallback:", mlErr.message);
      recommendation = ruleBasedFertilizer(inputPayload);
    }
  } else {
    recommendation = ruleBasedFertilizer(inputPayload);
  }

  const result = {
    timestamp: new Date(),
    model:     modelUsed,
    crop:      "Paddy (Rice)",
    input:     inputPayload,
    ...recommendation,
    note: "Dosage is indicative for 1 ha. Consult your local agricultural extension officer for exact rates.",
  };

  // 3. Save AI decision to MongoDB
  const col = getCollection(COLLECTIONS.AI_DECISIONS);
  if (col) {
    await col.insertOne({ type: "FERTILIZER", ...result });
  }

  return result;
};

/**
 * Return the latest saved fertilizer recommendation from MongoDB.
 */
const getLatestFertilizerRecommendation = async () => {
  const col = getCollection(COLLECTIONS.AI_DECISIONS);
  if (!col) return null;
  const docs = await col
    .find({ type: "FERTILIZER" })
    .sort({ timestamp: -1 })
    .limit(1)
    .toArray();
  return docs[0] || null;
};

module.exports = {
  getFertilizerRecommendation,
  getLatestFertilizerRecommendation,
  ruleBasedFertilizer,
};
