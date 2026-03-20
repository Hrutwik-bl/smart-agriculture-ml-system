const fetch = require("node-fetch");
const { ApiError } = require("../utils/errors");
const { AGMARKNET_API_BASE, AGMARKNET_RESOURCE_ID, DATA_GOV_API_KEY } = require("../config");

const canUseAgmarknet = () => Boolean(DATA_GOV_API_KEY && AGMARKNET_RESOURCE_ID);

const fetchAgmarknetPrices = async ({ crop, location, state, limit = 50 }) => {
  if (!canUseAgmarknet()) {
    throw new ApiError("Agmarknet API not configured", 400, "AGMARKNET_NOT_CONFIGURED");
  }

  const params = new URLSearchParams({
    "api-key": DATA_GOV_API_KEY,
    format: "json",
    limit: String(limit)
  });

  if (crop) {
    params.set("filters[commodity]", crop);
  }
  if (location) {
    params.set("filters[market]", location);
  }
  if (state) {
    params.set("filters[state]", state);
  }

  const url = `${AGMARKNET_API_BASE}/${AGMARKNET_RESOURCE_ID}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError("Agmarknet API request failed", 502, "AGMARKNET_FAILED");
  }
  const payload = await response.json();
  return payload.records || [];
};

module.exports = {
  canUseAgmarknet,
  fetchAgmarknetPrices
};
