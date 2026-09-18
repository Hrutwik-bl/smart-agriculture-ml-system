/**
 * settingsService.js
 *
 * Persists and retrieves farmer/device settings in MongoDB.
 * Falls back to in-memory defaults if DB is not connected.
 */

const { getCollection, COLLECTIONS } = require("./db");

// Default settings template (used when no settings exist for a user yet)
const defaultSettings = (username) => ({
  userId: username,
  farmer: {
    name:     "",
    location: "",
    phone:    "",
  },
  field: {
    name:           "Field 1",
    area:           "",
    crop:           "Paddy",
    soilType:       "Clay Loam",
    irrigationType: "Drip / Flood",
  },
  growthStage: "Vegetative",
  devices: {
    esp32: {
      host:          "192.168.1.x",   // Raspberry Pi IP that ESP32 posts to
      status:        "UNKNOWN",
    },
    raspberryPi: {
      host:          "192.168.1.x",
      status:        "UNKNOWN",
    },
    pump: {
      type:          "DC Water Pump",
      status:        "UNKNOWN",
    },
  },
  preferences: {
    language:          "en",
    alertLevel:        "HIGH",
    notificationEmail: false,
    notificationSMS:   false,
  },
  thresholds: {
    soilMoistureLow:  40,
    soilMoistureHigh: 70,
    tempHighAlert:    38,
    rainfallSkip:     10,
  },
  updatedAt: null,
});

const getSettings = async (username) => {
  const col = getCollection(COLLECTIONS.SETTINGS);
  if (col && username) {
    const doc = await col.findOne({ userId: username });
    if (doc) {
      // Strip MongoDB internal _id from response
      const { _id, ...rest } = doc;
      return rest;
    }
  }
  // Return defaults if no record exists yet
  return defaultSettings(username || "guest");
};

const updateSettings = async (username, updates) => {
  if (!updates || typeof updates !== "object") {
    return { success: false, message: "No updates provided" };
  }

  const col = getCollection(COLLECTIONS.SETTINGS);
  const timestamp = new Date();

  if (col && username) {
    // Upsert — create the document if it doesn't exist yet
    await col.updateOne(
      { userId: username },
      {
        $set: {
          ...updates,
          userId:    username,
          updatedAt: timestamp,
        },
      },
      { upsert: true }
    );
  }

  return {
    success:   true,
    message:   "Settings updated successfully",
    timestamp,
  };
};

module.exports = { getSettings, updateSettings };
