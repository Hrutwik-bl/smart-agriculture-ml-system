const fetch = require("node-fetch");
const { NASA_POWER_BASE } = require("../config");
const { ApiError } = require("../utils/errors");

const getDailyMetrics = async ({ lat, lon }) => {
  const params = new URLSearchParams({
    parameters: "T2M,PRECTOT,RH2M",
    community: "AG",
    longitude: String(lon),
    latitude: String(lat),
    format: "JSON"
  });
  const url = `${NASA_POWER_BASE}/daily/point?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError("Failed to fetch NASA POWER data", 502, "NASA_POWER_FAILED");
  }
  return response.json();
};

module.exports = {
  getDailyMetrics
};
