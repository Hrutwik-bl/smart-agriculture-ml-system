const { getCollection, COLLECTIONS } = require("./db");
const { getLatestWeather } = require("./weatherService");
const { getLatestSensorData } = require("./sensorService");

const FLOW_RATE_MM_PER_MIN = 0.5;

// Raspberry Pi ML service
const RASPBERRY_PI_ML_URL =
  process.env.RASPBERRY_PI_ML_URL || "http://127.0.0.1:8000";

const ruleBasedIrrigation = ({
  soilMoisture,
  temperature,
  humidity,
  rainfall24h,
}) => {
  const moisture = soilMoisture ?? 50;
  const temp = temperature ?? 28;
  const hum = humidity ?? 70;
  const rain = rainfall24h ?? 0;

  if (rain >= 10) {
    return {
      irrigate: false,
      reason: "Sufficient rainfall expected in the next 24 hours",
      waterRequirementMm: 0,
    };
  }

  if (moisture >= 70) {
    return {
      irrigate: false,
      reason: "Soil moisture is in the optimal range",
      waterRequirementMm: 0,
    };
  }

  const base = 4.0;
  const tempFactor = Math.max(0, (temp - 25) * 0.18);
  const humFactor = Math.max(0, (50 - hum) * 0.02);
  const rainOffset = Math.min(4, rain / 10);

  const requirement = Math.max(
    0.5,
    base + tempFactor + humFactor - rainOffset
  );

  const irrigate = moisture < 40;

  return {
    irrigate,
    waterRequirementMm: Number(requirement.toFixed(2)),
    reason: irrigate
      ? `Soil moisture (${moisture}%) is below the irrigation threshold`
      : "Soil moisture is acceptable",
  };
};

const estimateDurationMin = (requirementMm) => {
  if (!requirementMm || requirementMm <= 0) return 0;
  return Math.ceil(requirementMm / FLOW_RATE_MM_PER_MIN);
};

const callRaspberryPiML = async (input) => {
  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${RASPBERRY_PI_ML_URL}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`ML server returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
};

const getIrrigationDecision = async ({
  sensorOverride = null,
  weatherOverride = null,
} = {}) => {
  // Get latest sensor data
  let sensorDoc = sensorOverride;

  if (!sensorDoc) {
    const latest = await getLatestSensorData();

    sensorDoc = {
      soilMoisture: latest.soilMoisture?.value,
      temperature: latest.temperature?.value,
      humidity: latest.humidity?.value,
      waterLevel: latest.waterLevel?.value,
    };
  }

  // Get latest weather data
  let weatherDoc = weatherOverride;

  if (!weatherDoc) {
    const wx = await getLatestWeather();

    weatherDoc = {
      rainfall24h: wx?.rainfall24h ?? 0,
      temperature: wx?.temperature ?? sensorDoc.temperature,
      humidity: wx?.humidity ?? sensorDoc.humidity,
      windSpeed: wx?.windSpeed ?? 10,
    };
  }

  /*
   * The trained model requires 19 features.
   * Hardware sensors provide the live values.
   * Project configuration provides the remaining crop/field values.
   */

  const mlInput = {
    Soil_Type: "Loamy",
    Soil_pH: 6.5,
    Soil_Moisture: sensorDoc.soilMoisture ?? 50,
    Organic_Carbon: 0.8,
    Electrical_Conductivity: 0.5,
    Temperature_C:
      sensorDoc.temperature ?? weatherDoc.temperature ?? 28,
    Humidity: sensorDoc.humidity ?? weatherDoc.humidity ?? 70,
    Rainfall_mm: weatherDoc.rainfall24h ?? 0,
    Sunlight_Hours: 7,
    Wind_Speed_kmh: weatherDoc.windSpeed ?? 10,
    Crop_Type: "Rice",
    Crop_Growth_Stage: "Vegetative",
    Season: "Monsoon",
    Irrigation_Type: "Flood",
    Water_Source: "Canal",
    Field_Area_hectare: 1.0,
    Mulching_Used: "No",
    Previous_Irrigation_mm: 20,
    Region: "South India",
  };

  let decision;
  let modelUsed = "rule-based";

  /*
   * Try Raspberry Pi ML.
   * If it is not reachable, use the safe rule-based fallback.
   */
  try {
    const mlResult = await callRaspberryPiML(mlInput);

    const prediction = mlResult.prediction || mlResult.irrigationNeed;

    const irrigate =
      prediction === "High" || prediction === "Medium";

    decision = {
      irrigate,
      waterRequirementMm: irrigate ? 4 : 0,
      confidence: mlResult.confidence ?? null,
      reason: `Raspberry Pi ML prediction: ${prediction}`,
    };

    modelUsed = "Random Forest - Raspberry Pi";
  } catch (error) {
    console.warn(
      "[irrigationService] Raspberry Pi ML unavailable, using rule-based fallback:",
      error.message
    );

    decision = ruleBasedIrrigation({
      soilMoisture: sensorDoc.soilMoisture,
      temperature:
        sensorDoc.temperature ?? weatherDoc.temperature,
      humidity:
        sensorDoc.humidity ?? weatherDoc.humidity,
      rainfall24h: weatherDoc.rainfall24h,
    });
  }

  const durationMin = estimateDurationMin(
    decision.waterRequirementMm
  );

  const result = {
    timestamp: new Date(),

    model: modelUsed,

    input: {
      ...mlInput,
    },

    irrigate: decision.irrigate,

    irrigationNeed:
      decision.reason?.replace("Raspberry Pi ML prediction: ", "") ||
      null,

    waterRequirementMm:
      decision.waterRequirementMm ?? null,

    durationMinutes: durationMin,

    confidence: decision.confidence ?? null,

    reason: decision.reason,

    recommendation: decision.irrigate
      ? `Irrigate for approximately ${durationMin} minutes`
      : decision.reason,
  };

  // Save decision to MongoDB
  const col = getCollection(COLLECTIONS.AI_DECISIONS);

  if (col) {
    await col.insertOne({
      type: "IRRIGATION",
      ...result,
    });
  }

  return result;
};

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