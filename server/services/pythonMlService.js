const fetch = require("node-fetch");
const { ML_SERVICE_URL, ML_SERVICE_PREDICT_PATH } = require("../config");
const { ApiError } = require("../utils/errors");

const canUseMl = () => Boolean(ML_SERVICE_URL);

const buildPredictUrl = () => {
  if (!ML_SERVICE_URL) return null;
  const trimmed = ML_SERVICE_URL.replace(/\/$/, "");
  if (trimmed.endsWith("/predict-crop") || trimmed.endsWith("/crop-prediction")) {
    return trimmed;
  }
  const path = ML_SERVICE_PREDICT_PATH.startsWith("/")
    ? ML_SERVICE_PREDICT_PATH
    : `/${ML_SERVICE_PREDICT_PATH}`;
  return `${trimmed}${path}`;
};

const requestCropPrediction = async (payload) => {
  if (!ML_SERVICE_URL) {
    throw new ApiError("ML service URL not configured", 400, "ML_SERVICE_MISSING");
  }
  const url = buildPredictUrl();
  if (!url) {
    throw new ApiError("ML service URL not configured", 400, "ML_SERVICE_MISSING");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new ApiError("ML service error", 502, "ML_SERVICE_FAILED");
  }
  return response.json();
};

module.exports = {
  canUseMl,
  requestCropPrediction
};
