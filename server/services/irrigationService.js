const { ApiError } = require("../utils/errors");
const { getWeatherBundle, getCurrentWeather } = require("./weatherService");
const { getDailyMetrics } = require("./nasaPowerService");
const { OPENWEATHER_API_KEY } = require("../config");

const estimateWaterRequirement = ({ temperature, humidity, rainfall }) => {
  const base = 4.0;
  const tempFactor = temperature ? Math.max(0, (temperature - 25) * 0.2) : 0;
  const humidityFactor = humidity ? Math.max(0, (50 - humidity) * 0.02) : 0;
  const rainOffset = rainfall ? Math.min(4, rainfall / 10) : 0;
  const requirement = Math.max(0.5, base + tempFactor + humidityFactor - rainOffset);
  return Number(requirement.toFixed(2));
};

const buildRecommendation = ({ rainfall, requirement }) => {
  if (rainfall >= 10) {
    return "No irrigation needed due to expected rainfall.";
  }
  if (requirement <= 2.5) {
    return "Light irrigation recommended to maintain soil moisture.";
  }
  return "Irrigation recommended today to meet crop water demand.";
};

const getIrrigationPlan = async (input) => {
  const { location, lat, lon } = input;
  if (!location && (lat === undefined || lon === undefined)) {
    throw new ApiError("location or lat/lon required", 400, "LOCATION_REQUIRED");
  }

  let temperature = null;
  let humidity = null;
  let rainfall = 0;
  let source = "rule-based";
  let coords = null;

  if (OPENWEATHER_API_KEY && location) {
    const bundle = await getWeatherBundle(location);
    coords = bundle.coords;
    temperature = bundle.current.main ? bundle.current.main.temp : null;
    humidity = bundle.current.main ? bundle.current.main.humidity : null;
    const rainBlock = bundle.forecast.list ? bundle.forecast.list.slice(0, 4) : [];
    rainfall = rainBlock.reduce((acc, item) => acc + (item.rain ? item.rain["3h"] || 0 : 0), 0);
    source = "openweather";
  } else if (OPENWEATHER_API_KEY && lat !== undefined && lon !== undefined) {
    const current = await getCurrentWeather(lat, lon);
    temperature = current.main ? current.main.temp : null;
    humidity = current.main ? current.main.humidity : null;
    rainfall = current.rain ? current.rain["1h"] || 0 : 0;
    source = "openweather";
  } else if (lat !== undefined && lon !== undefined) {
    const power = await getDailyMetrics({ lat, lon });
    const data = power.properties && power.properties.parameter ? power.properties.parameter : {};
    const tempValues = data.T2M ? Object.values(data.T2M) : [];
    const humValues = data.RH2M ? Object.values(data.RH2M) : [];
    const rainValues = data.PRECTOT ? Object.values(data.PRECTOT) : [];
    temperature = tempValues.length ? tempValues[tempValues.length - 1] : null;
    humidity = humValues.length ? humValues[humValues.length - 1] : null;
    rainfall = rainValues.length ? rainValues[rainValues.length - 1] : 0;
    source = "nasa-power";
  }

  const requirement = estimateWaterRequirement({ temperature, humidity, rainfall });

  return {
    source,
    coordinates: coords || (lat !== undefined && lon !== undefined ? { lat, lon } : null),
    weather: {
      temperature,
      humidity,
      rainfall
    },
    waterRequirementMmPerDay: requirement,
    recommendation: buildRecommendation({ rainfall, requirement })
  };
};

module.exports = {
  getIrrigationPlan
};
