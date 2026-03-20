const { loadCsv } = require("./datasetService");
const { CROP_PRICE_CSV_PATH, DEMO_MODE } = require("../config");
const { canUseAgmarknet, fetchAgmarknetPrices } = require("./agmarknetService");
const { ApiError } = require("../utils/errors");

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const extractSeries = (rows, crop, location) => {
  const lowerCrop = String(crop).toLowerCase();
  const lowerLocation = String(location || "").toLowerCase();
  return rows
    .filter((row) => {
      const cropField = String(row.crop || row.Commodity || row.commodity || "").toLowerCase();
      const marketField = String(row.market || row.Market || row.district || row.District || "").toLowerCase();
      return cropField.includes(lowerCrop) && (!lowerLocation || marketField.includes(lowerLocation));
    })
    .map((row) =>
      toNumber(row.modal_price || row.modalPrice || row.price || row.Price || row.modal)
    )
    .filter((value) => value !== null);
};

const extractSeriesFromAgmarknet = (records) =>
  records
    .map((row) => toNumber(row.modal_price || row.modalPrice || row.price || row.modal))
    .filter((value) => value !== null);

const forecastFromSeries = (series) => {
  if (!series.length) return null;
  const tail = series.slice(-3);
  const avg = tail.reduce((acc, value) => acc + value, 0) / tail.length;
  const monthAvg = series.reduce((acc, value) => acc + value, 0) / series.length;
  return {
    nextWeek: Number(avg.toFixed(2)),
    nextMonth: Number(monthAvg.toFixed(2))
  };
};

const mockForecast = (crop, location) => {
  const base = 18 + (hashString(`${crop}-${location}`) % 35);
  return {
    nextWeek: base,
    nextMonth: Number((base + 2.5).toFixed(2))
  };
};

const getPricePrediction = async ({ crop, location, state }) => {
  if (!crop) {
    throw new ApiError("crop is required", 400, "CROP_REQUIRED");
  }

  const dataset = await loadCsv(CROP_PRICE_CSV_PATH);
  if (dataset && dataset.length) {
    const series = extractSeries(dataset, crop, location || "");
    const forecast = forecastFromSeries(series);
    if (forecast) {
      return {
        source: "price-csv",
        forecast,
        seriesLength: series.length
      };
    }
  }

  if (canUseAgmarknet()) {
    const records = await fetchAgmarknetPrices({ crop, location, state });
    const series = extractSeriesFromAgmarknet(records);
    const forecast = forecastFromSeries(series);
    if (forecast) {
      return {
        source: "agmarknet-api",
        forecast,
        seriesLength: series.length
      };
    }
  }

  if (DEMO_MODE) {
    return {
      source: "mock",
      forecast: mockForecast(crop, location || "India"),
      seriesLength: 0
    };
  }

  throw new ApiError("Price dataset not available", 404, "PRICE_DATA_MISSING");
};

module.exports = {
  getPricePrediction
};
