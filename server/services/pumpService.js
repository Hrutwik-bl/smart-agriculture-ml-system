/**
 * pumpService.js
 *
 * Tracks pump ON/OFF state and logs every control event to MongoDB.
 *
 * The Raspberry Pi is the actual hardware controller — it polls
 * GET /api/pump/status and executes the relay accordingly.
 * This service is the server-side state store.
 */

const { getCollection, COLLECTIONS } = require("./db");
const { ApiError } = require("../utils/errors");

const VALID_COMMANDS = ["ON", "OFF"];

// ─── Pump log helpers ─────────────────────────────────────────────────────────

/**
 * Log a pump control event to MongoDB.
 */
const logPumpEvent = async ({ command, triggeredBy, reason, durationMinutes = null }) => {
  const entry = {
    timestamp:       new Date(),
    command:         command.toUpperCase(),
    triggeredBy:     triggeredBy || "manual",   // "ai-decision" | "manual" | "raspberry-pi"
    reason:          reason || "",
    durationMinutes: durationMinutes,
    status:          "LOGGED",
  };

  const col = getCollection(COLLECTIONS.PUMP_LOGS);
  if (col) {
    const result = await col.insertOne(entry);
    return { ...entry, _id: result.insertedId };
  }

  return entry;
};

/**
 * Send a pump control command.
 * Validates the command and writes it to the pump_logs collection.
 * The Raspberry Pi polls /api/pump/status to pick up the latest command.
 */
const controlPump = async ({ command, triggeredBy = "manual", reason = "", durationMinutes = null }) => {
  const cmd = String(command || "").toUpperCase();
  if (!VALID_COMMANDS.includes(cmd)) {
    throw new ApiError(
      `Invalid pump command "${command}". Must be ON or OFF.`,
      400,
      "INVALID_PUMP_COMMAND"
    );
  }

  const logEntry = await logPumpEvent({ command: cmd, triggeredBy, reason, durationMinutes });

  return {
    command:         cmd,
    triggeredBy,
    reason,
    durationMinutes,
    timestamp:       logEntry.timestamp,
    acknowledged:    false,   // Raspberry Pi sets this to true when it executes
  };
};

/**
 * Return the latest pump command and whether the pump is currently ON or OFF.
 */
const getPumpStatus = async () => {
  const col = getCollection(COLLECTIONS.PUMP_LOGS);
  if (!col) {
    return {
      currentCommand: "UNKNOWN",
      isOn:           false,
      lastEvent:      null,
      source:         "no-db",
    };
  }

  const docs = await col.find({}).sort({ timestamp: -1 }).limit(1).toArray();
  if (!docs.length) {
    return {
      currentCommand: "OFF",
      isOn:           false,
      lastEvent:      null,
      source:         "no-history",
    };
  }

  const last = docs[0];
  return {
    currentCommand: last.command,
    isOn:           last.command === "ON",
    lastEvent:      {
      command:         last.command,
      triggeredBy:     last.triggeredBy,
      reason:          last.reason,
      durationMinutes: last.durationMinutes,
      timestamp:       last.timestamp,
    },
    source: "mongodb",
  };
};

/**
 * Return the last N pump log entries for the history view.
 */
const getPumpHistory = async (limit = 20) => {
  const col = getCollection(COLLECTIONS.PUMP_LOGS);
  if (!col) return [];
  return col.find({}).sort({ timestamp: -1 }).limit(limit).toArray();
};

module.exports = {
  controlPump,
  getPumpStatus,
  getPumpHistory,
  logPumpEvent,
};
