const fetch = require("node-fetch");
const { ApiError } = require("../utils/errors");
const { OPENWEATHER_API_KEY } = require("../config");

const requireKey = () => {
  if (!OPENWEATHER_API_KEY) {
    throw new ApiError("OpenWeatherMap API key is missing", 400, "MISSING_API_KEY");
  }
};

const getCoordinates = async (location) => {
  requireKey();
  const query = encodeURIComponent(location);
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=1&appid=${OPENWEATHER_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError("Failed to resolve location", 502, "WEATHER_GEOCODE_FAILED");
  }
  const data = await response.json();
  if (!data.length) {
    throw new ApiError("Location not found", 404, "LOCATION_NOT_FOUND");
  }
  const record = data[0];
  return {
    lat: record.lat,
    lon: record.lon,
    name: record.name,
    country: record.country,
    state: record.state || ""
  };
};

const getCurrentWeather = async (lat, lon) => {
  requireKey();
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError("Failed to fetch current weather", 502, "WEATHER_CURRENT_FAILED");
  }
  return response.json();
};

const getForecast = async (lat, lon) => {
  requireKey();
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError("Failed to fetch forecast", 502, "WEATHER_FORECAST_FAILED");
  }
  return response.json();
};

const getWeatherBundle = async (location) => {
  const coords = await getCoordinates(location);
  const [current, forecast] = await Promise.all([
    getCurrentWeather(coords.lat, coords.lon),
    getForecast(coords.lat, coords.lon)
  ]);
  return { coords, current, forecast };
};

module.exports = {
  getCoordinates,
  getCurrentWeather,
  getForecast,
  getWeatherBundle
};
