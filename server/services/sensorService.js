/**
 * sensorService.js
 *
 * Handles ingestion and retrieval of ESP32 sensor readings.
 *
 * Expected ingest payload (sent by Raspberry Pi after collecting from ESP32):
 * {
 *   soilMoisture  : number  (%)
 *   temperature   : number  (°C)  — DHT22 air temperature
 *   humidity      : number  (%)   — DHT22 humidity
 *   nitrogen      : number  (mg/kg or raw ppm from NPK sensor)
 *   phosphorus    : number
 *   potassium     : number
 *   deviceId      : string  (optional, defaults to "esp32-node-1")
 * }
 */

const { getCollection, COLLECTIONS } = require("./db");
const { ApiError } = require("../utils/errors");

// Paddy optimal ranges — used for status classification
const RANGES = {
  soilMoisture: { low: 40, high: 70, unit: "%" },
  temperature:  { low: 20, high: 35, unit: "°C" },
  humidity:     { low: 60, high: 85, unit: "%" },
  nitrogen:     { low: 80, high: 200, unit: "mg/kg" },
  phosphorus:   { low: 20, high: 50,  unit: "mg/kg" },
  potassium:    { low: 100, high: 250, unit: "mg/kg" },
};

const classifyValue = (value, range) => {
  if (value === null || value === undefined) return "UNKNOWN";
  if (value < range.low)  return "LOW";
  if (value > range.high) return "HIGH";
  return "NORMAL";
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Validate and normalise an incoming sensor payload.
 * Throws ApiError on missing or invalid required fields.
 */
const parseSensorPayload = (body) => {
  const soilMoisture = toNum(body.soilMoisture);
  const temperature  = toNum(body.temperature);
  const humidity     = toNum(body.humidity);
  const nitrogen     = toNum(body.nitrogen);
  const phosphorus   = toNum(body.phosphorus);
  const potassium    = toNum(body.potassium);

  const missing = [];
  if (soilMoisture === null) missing.push("soilMoisture");
  if (temperature  === null) missing.push("temperature");
  if (humidity     === null) missing.push("humidity");
  if (nitrogen     === null) missing.push("nitrogen");
  if (phosphorus   === null) missing.push("phosphorus");
  if (potassium    === null) missing.push("potassium");

  if (missing.length) {
    throw new ApiError(
      `Missing or invalid sensor fields: ${missing.join(", ")}`,
      400,
      "INVALID_SENSOR_PAYLOAD"
    );
  }

  return {
    deviceId:    String(body.deviceId || "esp32-node-1"),
    soilMoisture,
    temperature,
    humidity,
    nitrogen,
    phosphorus,
    potassium,
    timestamp:   new Date(),
  };
};

/**
 * Ingest a sensor reading from the ESP32 (via Raspberry Pi).
 * Saves to MongoDB and returns the enriched document.
 */
const ingestSensorData = async (body) => {
  const reading = parseSensorPayload(body);

  const col = getCollection(COLLECTIONS.SENSOR_READINGS);
  if (col) {
    await col.insertOne({ ...reading });
  }

  return enrichReading(reading);
};

/**
 * Return the latest sensor reading from MongoDB.
 * Falls back to a clearly-labelled "no data" object if DB is unavailable.
 */
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

/**
 * Add status classifications and optimal-range labels to a raw reading.
 */
const enrichReading = (reading) => {
  const { soilMoisture, temperature, humidity, nitrogen, phosphorus, potassium } = reading;
  return {
    deviceId:    reading.deviceId || "esp32-node-1",
    timestamp:   reading.timestamp,
    source:      "ESP32",
    soilMoisture: {
      value:        soilMoisture,
      unit:         RANGES.soilMoisture.unit,
      status:       classifyValue(soilMoisture, RANGES.soilMoisture),
      optimalRange: `${RANGES.soilMoisture.low}–${RANGES.soilMoisture.high}${RANGES.soilMoisture.unit}`,
    },
    temperature: {
      value:        temperature,
      unit:         RANGES.temperature.unit,
      status:       classifyValue(temperature, RANGES.temperature),
      optimalRange: `${RANGES.temperature.low}–${RANGES.temperature.high}${RANGES.temperature.unit}`,
    },
    humidity: {
      value:        humidity,
      unit:         RANGES.humidity.unit,
      status:       classifyValue(humidity, RANGES.humidity),
      optimalRange: `${RANGES.humidity.low}–${RANGES.humidity.high}${RANGES.humidity.unit}`,
    },
    nitrogen: {
      value:        nitrogen,
      unit:         RANGES.nitrogen.unit,
      status:       classifyValue(nitrogen, RANGES.nitrogen),
      optimalRange: `${RANGES.nitrogen.low}–${RANGES.nitrogen.high} ${RANGES.nitrogen.unit}`,
    },
    phosphorus: {
      value:        phosphorus,
      unit:         RANGES.phosphorus.unit,
      status:       classifyValue(phosphorus, RANGES.phosphorus),
      optimalRange: `${RANGES.phosphorus.low}–${RANGES.phosphorus.high} ${RANGES.phosphorus.unit}`,
    },
    potassium: {
      value:        potassium,
      unit:         RANGES.potassium.unit,
      status:       classifyValue(potassium, RANGES.potassium),
      optimalRange: `${RANGES.potassium.low}–${RANGES.potassium.high} ${RANGES.potassium.unit}`,
    },
  };
};

const _noDataFallback = () => ({
  deviceId:    "esp32-node-1",
  timestamp:   null,
  source:      "NO_DATA",
  soilMoisture: { value: null, unit: "%",     status: "UNKNOWN", optimalRange: "40–70%" },
  temperature:  { value: null, unit: "°C",    status: "UNKNOWN", optimalRange: "20–35°C" },
  humidity:     { value: null, unit: "%",     status: "UNKNOWN", optimalRange: "60–85%" },
  nitrogen:     { value: null, unit: "mg/kg", status: "UNKNOWN", optimalRange: "80–200 mg/kg" },
  phosphorus:   { value: null, unit: "mg/kg", status: "UNKNOWN", optimalRange: "20–50 mg/kg" },
  potassium:    { value: null, unit: "mg/kg", status: "UNKNOWN", optimalRange: "100–250 mg/kg" },
});

module.exports = {
  ingestSensorData,
  getLatestSensorData,
  enrichReading,
  RANGES,
};
