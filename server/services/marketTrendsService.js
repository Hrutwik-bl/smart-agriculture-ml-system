const { loadCsv } = require("./datasetService");
const { CROP_PRICE_CSV_PATH, DEMO_MODE } = require("../config");
const { ApiError } = require("../utils/errors");

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getMarketTrends = async ({ location }) => {
  const dataset = await loadCsv(CROP_PRICE_CSV_PATH);
  if (dataset && dataset.length) {
    const grouped = new Map();

    dataset.forEach((row) => {
      const crop = String(row.crop || row.Commodity || row.commodity || "").trim();
      if (!crop) return;
      if (location) {
        const marketField = String(row.market || row.Market || row.district || row.District || "").toLowerCase();
        if (!marketField.includes(String(location).toLowerCase())) return;
      }
      const price = toNumber(row.modal_price || row.modalPrice || row.price || row.Price || row.modal);
      if (price === null) return;
      const entry = grouped.get(crop) || { crop, prices: [] };
      entry.prices.push(price);
      grouped.set(crop, entry);
    });

    const trends = Array.from(grouped.values())
      .map((entry) => {
        const avg = entry.prices.reduce((acc, value) => acc + value, 0) / entry.prices.length;
        return {
          crop: entry.crop,
          averagePrice: Number(avg.toFixed(2)),
          observations: entry.prices.length
        };
      })
      .sort((a, b) => b.averagePrice - a.averagePrice)
      .slice(0, 5);

    return {
      source: "price-csv",
      trends
    };
  }

  if (DEMO_MODE) {
    return {
      source: "mock",
      trends: [
        { crop: "Tomato", averagePrice: 38.5, observations: 0 },
        { crop: "Onion", averagePrice: 34.2, observations: 0 },
        { crop: "Chili", averagePrice: 42.1, observations: 0 },
        { crop: "Banana", averagePrice: 28.4, observations: 0 },
        { crop: "Okra", averagePrice: 31.6, observations: 0 }
      ]
    };
  }

  throw new ApiError("Market dataset not available", 404, "MARKET_DATA_MISSING");
};

module.exports = {
  getMarketTrends
};
