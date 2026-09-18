const { MongoClient } = require("mongodb");
const { MONGODB_URI } = require("../config");

let cachedClient = null;
let cachedDb = null;

const DB_NAME = "smart_irrigation";

// Collection names — single source of truth
const COLLECTIONS = {
  SENSOR_READINGS: "sensorReadings",
  WEATHER_SNAPSHOTS: "weatherSnapshots",
  AI_DECISIONS: "aiDecisions",
  PUMP_LOGS: "pumpLogs",
  SETTINGS: "settings",
};

/**
 * Connect to MongoDB and return the client.
 * Returns null gracefully if MONGODB_URI is not set.
 */
const connectDb = async () => {
  if (!MONGODB_URI) return null;
  if (cachedClient) return cachedClient;

  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });
  await client.connect();
  cachedClient = client;
  cachedDb = client.db(DB_NAME);

  // Create indexes once on first connect
  await _ensureIndexes(cachedDb);

  return cachedClient;
};

/**
 * Returns the database instance. Throws if not yet connected.
 */
const getDb = () => {
  if (!cachedDb) {
    throw new Error("Database not initialised. Call connectDb() first.");
  }
  return cachedDb;
};

/**
 * Returns a collection by name. Returns null if DB not connected
 * so callers can fall back gracefully.
 */
const getCollection = (name) => {
  try {
    return getDb().collection(name);
  } catch (_) {
    return null;
  }
};

/**
 * Ensure TTL + query indexes exist on each collection.
 * TTL: sensorReadings and weatherSnapshots expire after 90 days.
 *      aiDecisions and pumpLogs kept for 180 days.
 */
const _ensureIndexes = async (db) => {
  try {
    // sensorReadings
    const sensors = db.collection(COLLECTIONS.SENSOR_READINGS);
    await sensors.createIndex({ timestamp: -1 });                          // latest-first queries
    await sensors.createIndex({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // TTL 90d

    // weatherSnapshots
    const weather = db.collection(COLLECTIONS.WEATHER_SNAPSHOTS);
    await weather.createIndex({ timestamp: -1 });
    await weather.createIndex({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

    // aiDecisions
    const decisions = db.collection(COLLECTIONS.AI_DECISIONS);
    await decisions.createIndex({ timestamp: -1 });
    await decisions.createIndex({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

    // pumpLogs
    const pump = db.collection(COLLECTIONS.PUMP_LOGS);
    await pump.createIndex({ timestamp: -1 });
    await pump.createIndex({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

    // settings — unique per userId
    const settings = db.collection(COLLECTIONS.SETTINGS);
    await settings.createIndex({ userId: 1 }, { unique: true });
  } catch (err) {
    // Non-fatal — indexes may already exist or auth may not allow createIndex
    console.warn("[db] Index creation warning:", err.message);
  }
};

module.exports = {
  connectDb,
  getDb,
  getCollection,
  COLLECTIONS,
};
