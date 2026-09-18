/**
 * pythonMlService.js
 *
 * HTTP bridge to the Python / FastAPI ML service.
 * Provides three prediction functions:
 *   1. predictIrrigation  — Random Forest + SVR → irrigate YES/NO + water requirement
 *   2. predictFertilizer  — NPK-based model → fertilizer recommendation
 *   3. predictCrop        — existing crop suitability model (kept for compatibility)
 */

const fetch = require("node-fetch");
const { ML_SERVICE_URL, ML_IRRIGATION_PATH, ML_FERTILIZER_PATH, ML_SERVICE_PREDICT_PATH } = require("../config");
const { ApiError } = require("../utils/errors");

const TIMEOUT_MS = 8000;

const mlAvailable = () => Boolean(ML_SERVICE_URL);

const buildUrl = (path) => {
  if (!ML_SERVICE_URL) return null;
  const base = ML_SERVICE_URL.replace(/\/$/, "");
  const p    = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
};

/**
 * Generic POST helper with timeout and structured error handling.
 */
const callMl = async (path, payload) => {
  const url = buildUrl(path);
  if (!url) {
    throw new ApiError("ML service URL not configured", 400, "ML_SERVICE_MISSING");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).detail || ""; } catch (_) {}
      throw new ApiError(
        `ML service error: ${detail || res.statusText}`,
        502,
        "ML_SERVICE_FAILED"
      );
    }

    return res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new ApiError("ML service timed out", 504, "ML_SERVICE_TIMEOUT");
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(`ML service unreachable: ${err.message}`, 502, "ML_SERVICE_UNREACHABLE");
  }
};

// ─── Public prediction functions ──────────────────────────────────────────────

/**
 * Irrigation prediction.
 *
 * Payload:
 *   soilMoisture, temperature, humidity, nitrogen, phosphorus, potassium,
 *   rainfall24h (optional, from weather snapshot)
 *
 * Expected response from ML service:
 *   { irrigate: true|false, waterRequirementMm: number, confidence: number, model: string }
 */
const predictIrrigation = async (payload) => {
  return callMl(ML_IRRIGATION_PATH, payload);
};

/**
 * Fertilizer / NPK recommendation prediction.
 *
 * Payload:
 *   nitrogen, phosphorus, potassium, temperature, humidity,
 *   soilMoisture (optional), cropStage (optional)
 *
 * Expected response from ML service:
 *   { recommendation: string, fertilizers: [...], priority: string, confidence: number }
 */
const predictFertilizer = async (payload) => {
  return callMl(ML_FERTILIZER_PATH, payload);
};

/**
 * Crop suitability prediction (existing endpoint, kept for compatibility).
 *
 * Payload: N, P, K, temperature, humidity, ph, rainfall
 */
const predictCrop = async (payload) => {
  return callMl(ML_SERVICE_PREDICT_PATH, payload);
};

module.exports = {
  mlAvailable,
  predictIrrigation,
  predictFertilizer,
  predictCrop,
};
