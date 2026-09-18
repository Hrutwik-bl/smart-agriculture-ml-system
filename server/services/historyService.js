/**
 * historyService.js
 *
 * Returns historical sensor readings, pump events, and AI decisions
 * from MongoDB. Computes summary analytics over the requested period.
 */

const { getCollection, COLLECTIONS } = require("./db");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const avg = (arr) =>
  arr.length ? Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2)) : null;

const sum = (arr) =>
  Number(arr.reduce((s, v) => s + v, 0).toFixed(2));

const trend = (arr) => {
  if (arr.length < 2) return "STABLE";
  const first = arr.slice(0, Math.ceil(arr.length / 2));
  const last  = arr.slice(Math.ceil(arr.length / 2));
  const diff  = avg(last) - avg(first);
  if (diff >  1.5) return "INCREASING";
  if (diff < -1.5) return "DECREASING";
  return "STABLE";
};

// ─── Main service ─────────────────────────────────────────────────────────────

const getHistoryData = async (days = 7) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [sensorCol, pumpCol, decisionCol] = [
    getCollection(COLLECTIONS.SENSOR_READINGS),
    getCollection(COLLECTIONS.PUMP_LOGS),
    getCollection(COLLECTIONS.AI_DECISIONS),
  ];

  // Parallel queries
  const [sensorDocs, pumpDocs, irrigDocs] = await Promise.all([
    sensorCol  ? sensorCol.find({ timestamp: { $gte: since } }).sort({ timestamp: 1 }).toArray() : [],
    pumpCol    ? pumpCol.find({ timestamp: { $gte: since } }).sort({ timestamp: -1 }).toArray() : [],
    decisionCol ? decisionCol.find({ type: "IRRIGATION", timestamp: { $gte: since } }).sort({ timestamp: 1 }).toArray() : [],
  ]);

  // ── Sensor records ──────────────────────────────────────────────────────────
  const sensorRecords = sensorDocs.map((d) => ({
    timestamp:    d.timestamp,
    soilMoisture: d.soilMoisture,
    temperature:  d.temperature,
    humidity:     d.humidity,
    nitrogen:     d.nitrogen,
    phosphorus:   d.phosphorus,
    potassium:    d.potassium,
  }));

  // ── Sensor analytics ────────────────────────────────────────────────────────
  const moisture  = sensorDocs.map((d) => d.soilMoisture).filter((v) => v != null);
  const temps     = sensorDocs.map((d) => d.temperature).filter((v) => v != null);
  const humids    = sensorDocs.map((d) => d.humidity).filter((v) => v != null);
  const nitro     = sensorDocs.map((d) => d.nitrogen).filter((v) => v != null);

  const sensorSummary = {
    readings:           sensorDocs.length,
    avgSoilMoisture:    avg(moisture),
    avgTemperature:     avg(temps),
    avgHumidity:        avg(humids),
    avgNitrogen:        avg(nitro),
    moistureTrend:      trend(moisture),
    temperatureTrend:   trend(temps),
  };

  // ── Pump summary ────────────────────────────────────────────────────────────
  const pumpOnEvents = pumpDocs.filter((d) => d.command === "ON");
  const totalDuration = sum(pumpOnEvents.map((d) => d.durationMinutes || 0));

  const pumpSummary = {
    totalEvents:      pumpDocs.length,
    irrigationCycles: pumpOnEvents.length,
    totalDurationMin: totalDuration,
    recentEvents:     pumpDocs.slice(0, 10).map((d) => ({
      command:         d.command,
      triggeredBy:     d.triggeredBy,
      reason:          d.reason,
      durationMinutes: d.durationMinutes,
      timestamp:       d.timestamp,
    })),
  };

  // ── AI decision summary ─────────────────────────────────────────────────────
  const irrigateTrue  = irrigDocs.filter((d) => d.irrigate === true).length;
  const irrigateFalse = irrigDocs.filter((d) => d.irrigate === false).length;

  const decisionSummary = {
    totalDecisions:  irrigDocs.length,
    irrigateYes:     irrigateTrue,
    irrigateNo:      irrigateFalse,
    avgWaterReqMm:   avg(irrigDocs.map((d) => d.waterRequirementMm).filter((v) => v != null)),
  };

  return {
    timestamp: new Date(),
    period:    `Last ${days} day${days !== 1 ? "s" : ""}`,
    since:     since,
    sensorRecords,
    sensorSummary,
    pumpSummary,
    decisionSummary,
  };
};

module.exports = { getHistoryData };
