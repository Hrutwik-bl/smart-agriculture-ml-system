const { getCollection, COLLECTIONS } = require("./db");
const { ApiError } = require("../utils/errors");

const RANGES = {
  soilMoisture: { low: 40, high: 70, unit: "%" },
  temperature: { low: 20, high: 35, unit: "°C" },
  humidity: { low: 60, high: 85, unit: "%" },
  waterLevel: { low: 10, high: 100, unit: "%" },
};

const classifyValue = (value, range) => {
  if (value === null || value === undefined) return "UNKNOWN";
  if (value < range.low) return "LOW";
  if (value > range.high) return "HIGH";
  return "NORMAL";
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const parseSensorPayload = (body) => {
  const soilMoisture = toNum(body.soilMoisture);
  const temperature = toNum(body.temperature);
  const humidity = toNum(body.humidity);
  const waterLevel = toNum(body.waterLevel);

  const missing = [];

  if (soilMoisture === null) missing.push("soilMoisture");
  if (temperature === null) missing.push("temperature");
  if (humidity === null) missing.push("humidity");
  if (waterLevel === null) missing.push("waterLevel");

  if (missing.length) {
    throw new ApiError(
      `Missing or invalid sensor fields: ${missing.join(", ")}`,
      400,
      "INVALID_SENSOR_PAYLOAD"
    );
  }

  return {
    deviceId: String(body.deviceId || "esp32-node-1"),
    soilMoisture,
    temperature,
    humidity,
    waterLevel,
    timestamp: new Date(),
  };
};

const ingestSensorData = async (body) => {
  const reading = parseSensorPayload(body);

  const col = getCollection(COLLECTIONS.SENSOR_READINGS);

  if (col) {
    await col.insertOne({ ...reading });
  }

  return enrichReading(reading);
};

const getLatestSensorData = async () => {
  const col = getCollection(COLLECTIONS.SENSOR_READINGS);

  if (!col) return _noDataFallback();

  const doc = await col
    .find({})
    .sort({ timestamp: -1 })
    .limit(1)
    .toArray();

  if (!doc.length) return _noDataFallback();

  return enrichReading(doc[0]);
};

const enrichReading = (reading) => {
  const {
    soilMoisture,
    temperature,
    humidity,
    waterLevel,
  } = reading;

  return {
    deviceId: reading.deviceId || "esp32-node-1",
    timestamp: reading.timestamp,
    source: "ESP32",

    soilMoisture: {
      value: soilMoisture,
      unit: RANGES.soilMoisture.unit,
      status: classifyValue(soilMoisture, RANGES.soilMoisture),
      optimalRange: "40–70%",
    },

    temperature: {
      value: temperature,
      unit: RANGES.temperature.unit,
      status: classifyValue(temperature, RANGES.temperature),
      optimalRange: "20–35°C",
    },

    humidity: {
      value: humidity,
      unit: RANGES.humidity.unit,
      status: classifyValue(humidity, RANGES.humidity),
      optimalRange: "60–85%",
    },

    waterLevel: {
      value: waterLevel,
      unit: RANGES.waterLevel.unit,
      status: classifyValue(waterLevel, RANGES.waterLevel),
      optimalRange: "10–100%",
    },
  };
};

const _noDataFallback = () => ({
  deviceId: "esp32-node-1",
  timestamp: null,
  source: "NO_DATA",

  soilMoisture: {
    value: null,
    unit: "%",
    status: "UNKNOWN",
    optimalRange: "40–70%",
  },

  temperature: {
    value: null,
    unit: "°C",
    status: "UNKNOWN",
    optimalRange: "20–35°C",
  },

  humidity: {
    value: null,
    unit: "%",
    status: "UNKNOWN",
    optimalRange: "60–85%",
  },

  waterLevel: {
    value: null,
    unit: "%",
    status: "UNKNOWN",
    optimalRange: "10–100%",
  },
});

module.exports = {
  ingestSensorData,
  getLatestSensorData,
  enrichReading,
  RANGES,
};