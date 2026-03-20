const { canUseMl, requestCropPrediction } = require("./pythonMlService");

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const ruleBasedRecommendations = (input) => {
  const { season, soil = {} } = input;
  const temperature = normalizeNumber(soil.temperature);
  const humidity = normalizeNumber(soil.humidity);
  const rainfall = normalizeNumber(soil.rainfall);
  const ph = normalizeNumber(soil.ph);
  const n = normalizeNumber(soil.n);

  const candidates = [];

  if (rainfall !== null && rainfall > 200) {
    candidates.push({ crop: "Rice", reason: "High rainfall favors paddy cultivation", score: 0.88 });
  }
  if (temperature !== null && temperature > 30 && humidity !== null && humidity > 60) {
    candidates.push({ crop: "Cotton", reason: "Warm and humid climate supports cotton", score: 0.82 });
  }
  if (temperature !== null && temperature >= 20 && temperature <= 30 && rainfall !== null && rainfall >= 100) {
    candidates.push({ crop: "Maize", reason: "Moderate temperature with steady rain", score: 0.78 });
  }
  if (ph !== null && ph < 6.0) {
    candidates.push({ crop: "Potato", reason: "Acidic soil is suitable for potato", score: 0.72 });
  }
  if (ph !== null && ph > 7.5) {
    candidates.push({ crop: "Wheat", reason: "Slightly alkaline soil suits wheat", score: 0.7 });
  }
  if (n !== null && n < 40) {
    candidates.push({ crop: "Pulses", reason: "Low nitrogen favors legumes", score: 0.66 });
  }

  if (!candidates.length) {
    candidates.push(
      { crop: "Tomato", reason: "Balanced conditions for vegetables", score: 0.62 },
      { crop: "Onion", reason: "Stable market demand", score: 0.58 },
      { crop: "Chili", reason: "Resilient to varied conditions", score: 0.55 }
    );
  }

  if (season) {
    candidates.forEach((item) => {
      if (season.toLowerCase() === "rabi" && ["Wheat", "Mustard"].includes(item.crop)) {
        item.score += 0.05;
      }
      if (season.toLowerCase() === "kharif" && ["Rice", "Maize"].includes(item.crop)) {
        item.score += 0.05;
      }
    });
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({
      crop: item.crop,
      score: Math.min(0.95, Number(item.score.toFixed(2))),
      reason: item.reason
    }));
};

const getCropRecommendations = async (input) => {
  if (canUseMl()) {
    try {
      const payload = await requestCropPrediction(input);
      if (payload) {
        if (Array.isArray(payload.recommendations)) {
          return { source: "ml-service", recommendations: payload.recommendations };
        }
        if (Array.isArray(payload.top3)) {
          return {
            source: "ml-service",
            recommendations: payload.top3.map((crop, index) => ({
              crop,
              score: Number((0.9 - index * 0.1).toFixed(2)),
              reason: "ML model recommendation"
            }))
          };
        }
        if (payload.recommended_crop) {
          return {
            source: "ml-service",
            recommendations: [
              { crop: payload.recommended_crop, score: 0.9, reason: "ML model recommendation" }
            ]
          };
        }
      }
    } catch (error) {
      return { source: "rule-based", recommendations: ruleBasedRecommendations(input), warning: error.message };
    }
  }
  return { source: "rule-based", recommendations: ruleBasedRecommendations(input) };
};

module.exports = {
  getCropRecommendations
};
