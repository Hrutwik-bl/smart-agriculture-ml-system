/**
 * weatherService.js
 *
 * Fetches weather data from OpenWeatherMap and caches the latest
 * snapshot to MongoDB so other services can read it without extra API calls.
 */

const fetch = require("node-fetch");
const { ApiError } = require("../utils/errors");
const { OPENWEATHER_API_KEY } = require("../config");
const { getCollection, COLLECTIONS } = require("./db");

const BASE = "https://api.openweathermap.org";

const requireKey = () => {
  if (!OPENWEATHER_API_KEY) {
    throw new ApiError(
      "OpenWeatherMap API key is missing. Set OPENWEATHER_API_KEY in .env",
      400,
      "MISSING_API_KEY"
    );
  }
};

// ─── Raw OWM calls ────────────────────────────────────────────────────────────

const getCoordinates = async (location) => {
  requireKey();
  const url = `${BASE}/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${OPENWEATHER_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError("Failed to resolve location", 502, "WEATHER_GEOCODE_FAILED");
  const data = await res.json();
  if (!data.length) throw new ApiError(`Location not found: ${location}`, 404, "LOCATION_NOT_FOUND");
  const { lat, lon, name, country, state = "" } = data[0];
  return { lat, lon, name, country, state };
};

const getCurrentWeather = async (lat, lon) => {
  requireKey();
  const url = `${BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError("Failed to fetch current weather", 502, "WEATHER_CURRENT_FAILED");
  return res.json();
};

const getForecast = async (lat, lon) => {
  requireKey();
  // 5-day / 3-hour forecast — we'll use the first 8 slots (24 h)
  const url = `${BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&cnt=8&appid=${OPENWEATHER_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError("Failed to fetch weather forecast", 502, "WEATHER_FORECAST_FAILED");
  return res.json();
};

// ─── Normalised snapshot ──────────────────────────────────────────────────────

/**
 * Build a compact, normalised weather snapshot from OWM responses.
 * This is what we store in MongoDB and what other services consume.
 */
const buildSnapshot = (coords, current, forecast) => {
  const temp      = current.main?.temp      ?? null;
  const humidity  = current.main?.humidity  ?? null;
  const windSpeed = current.wind?.speed     ?? null;
  const condition = current.weather?.[0]?.description ?? "unknown";
  const icon      = current.weather?.[0]?.icon ?? "";

  // Sum rainfall from next 8 forecast periods (24 h window)
  const slots = forecast.list || [];
  const rainfall24h = slots.reduce((acc, slot) => {
    return acc + (slot.rain?.["3h"] || 0);
  }, 0);

  const maxTempForecast = slots.reduce((max, slot) => {
    return Math.max(max, slot.main?.temp_max ?? 0);
  }, temp ?? 0);

  return {
    timestamp:       new Date(),
    location:        coords.name,
    country:         coords.country,
    lat:             coords.lat,
    lon:             coords.lon,
    temperature:     temp !== null ? Number(temp.toFixed(1)) : null,
    humidity:        humidity,
    windSpeed:       windSpeed !== null ? Number(windSpeed.toFixed(1)) : null,
    condition,
    icon,
    rainfall24h:     Number(rainfall24h.toFixed(2)),  // mm expected in next 24 h
    maxTemp24h:      Number(maxTempForecast.toFixed(1)),
    forecastSlots:   slots.map((s) => ({
      time:        s.dt_txt,
      temp:        s.main?.temp ?? null,
      humidity:    s.main?.humidity ?? null,
      rainfall3h:  s.rain?.["3h"] || 0,
      condition:   s.weather?.[0]?.description ?? "",
    })),
  };
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a fresh weather snapshot for a location string and save to MongoDB.
 */
const fetchAndSaveWeather = async (location) => {
  const coords  = await getCoordinates(location);
  const [current, forecast] = await Promise.all([
    getCurrentWeather(coords.lat, coords.lon),
    getForecast(coords.lat, coords.lon),
  ]);

  const snapshot = buildSnapshot(coords, current, forecast);

  const col = getCollection(COLLECTIONS.WEATHER_SNAPSHOTS);
  if (col) {
    await col.insertOne({ ...snapshot });
  }

  return snapshot;
};

/**
 * Fetch by raw lat/lon (used when no location name is known).
 */
const fetchAndSaveWeatherByCoords = async (lat, lon) => {
  const [current, forecast] = await Promise.all([
    getCurrentWeather(lat, lon),
    getForecast(lat, lon),
  ]);
  const coords = { lat, lon, name: `${lat},${lon}`, country: "", state: "" };
  const snapshot = buildSnapshot(coords, current, forecast);

  const col = getCollection(COLLECTIONS.WEATHER_SNAPSHOTS);
  if (col) {
    await col.insertOne({ ...snapshot });
  }

  return snapshot;
};

/**
 * Return the most recent weather snapshot from MongoDB.
 * Falls back to a live fetch if the DB has no record yet.
 * Returns null if API key is missing and DB is empty.
 */
const getLatestWeather = async (location = null) => {
  const col = getCollection(COLLECTIONS.WEATHER_SNAPSHOTS);
  if (col) {
    const doc = await col.find({}).sort({ timestamp: -1 }).limit(1).toArray();
    if (doc.length) return doc[0];
  }

  // Nothing in DB — try a live fetch if we have a location and API key
  if (location && OPENWEATHER_API_KEY) {
    return fetchAndSaveWeather(location);
  }

  return null;
};

module.exports = {
  getCoordinates,
  getCurrentWeather,
  getForecast,
  fetchAndSaveWeather,
  fetchAndSaveWeatherByCoords,
  getLatestWeather,
  buildSnapshot,
};
