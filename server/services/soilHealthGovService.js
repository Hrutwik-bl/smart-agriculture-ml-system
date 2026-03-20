const fetch = require("node-fetch");
const { ApiError } = require("../utils/errors");
const { SOIL_HEALTH_API_KEY, DATA_GOV_API_KEY, SOIL_HEALTH_RESOURCE_ID } = require("../config");

const getApiKey = () => SOIL_HEALTH_API_KEY || DATA_GOV_API_KEY;

const canUseSoilHealthApi = () => Boolean(getApiKey() && SOIL_HEALTH_RESOURCE_ID);

const fetchSoilHealthRecords = async ({ location, limit = 500 }) => {
  if (!canUseSoilHealthApi()) {
    throw new ApiError("Soil health API not configured", 400, "SOIL_API_NOT_CONFIGURED");
  }

  const params = new URLSearchParams({
    "api-key": getApiKey(),
    format: "json",
    limit: String(limit)
  });

  if (location) {
    params.set("filters[District]", location);
  }

  const url = `https://api.data.gov.in/resource/${SOIL_HEALTH_RESOURCE_ID}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError("Soil health API request failed", 502, "SOIL_API_FAILED");
  }
  const payload = await response.json();
  return payload.records || [];
};

module.exports = {
  canUseSoilHealthApi,
  fetchSoilHealthRecords
};
