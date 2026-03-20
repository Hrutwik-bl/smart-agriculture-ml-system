const { getWeatherBundle } = require("./weatherService");

const buildAlerts = (bundle) => {
  const alerts = [];
  const forecastList = bundle.forecast.list || [];
  const nextDay = forecastList.slice(0, 8);

  const maxTemp = Math.max(...nextDay.map((item) => item.main?.temp_max || item.main?.temp || 0));
  const rainTotal = nextDay.reduce((acc, item) => acc + (item.rain ? item.rain["3h"] || 0 : 0), 0);
  const windMax = Math.max(...nextDay.map((item) => item.wind?.speed || 0));

  if (rainTotal >= 10) {
    alerts.push({ type: "rain", message: "Heavy rain expected in the next 24 hours." });
  } else if (rainTotal > 2) {
    alerts.push({ type: "rain", message: "Light rain expected in the next 24 hours." });
  }

  if (maxTemp >= 38) {
    alerts.push({ type: "heat", message: "High temperature alert for the next day." });
  }

  if (windMax >= 12) {
    alerts.push({ type: "wind", message: "Strong winds expected. Secure field equipment." });
  }

  if (!alerts.length) {
    alerts.push({ type: "info", message: "No severe weather alerts for the next 24 hours." });
  }

  return alerts;
};

const getWeatherAlerts = async (location) => {
  const bundle = await getWeatherBundle(location);
  return {
    source: "openweather",
    location: bundle.coords,
    alerts: buildAlerts(bundle)
  };
};

module.exports = {
  getWeatherAlerts
};
