// Crop & Soil information specific to Paddy
const getCropInfo = async () => {
  return {
    protocolVersion: "PROTOTYPE_v1",
    timestamp: new Date().toISOString(),
    crop: {
      name: "Paddy (Rice)",
      variety: "Local",
      plantingDate: "2025-05-15",
      daysAfterPlanting: 45
    },
    growthStage: {
      current: "Vegetative",
      startDate: "2025-05-15",
      expectedMaturity: "2025-08-15",
      stageDescription: "Active vegetative growth, tillering phase",
      waterRequirement: "High - 5-7mm per day"
    },
    soil: {
      type: "Clay Loam",
      ph: 6.8,
      organicMatter: "3.2%",
      waterHoldingCapacity: "High"
    },
    fieldInfo: {
      area: "2 hectares",
      location: "Field 1",
      irrigationType: "Flood irrigation (flooded paddy field)",
      soilMoisture: "38%",
      soilTemperature: "28°C"
    },
    npkStatus: {
      nitrogen: "LOW - 45 ppm",
      phosphorus: "NORMAL - 25 ppm",
      potassium: "LOW - 130 ppm"
    },
    recommendations: [
      "Maintain standing water level at 5-10 cm",
      "Apply nitrogen at vegetative stage",
      "Monitor for pest activity (stem borer, leaf roller)"
    ],
    nextMilestone: {
      stage: "Panicle Initiation",
      daysRemaining: 20,
      criticalAction: "Ensure adequate water and nutrient availability"
    }
  };
};

module.exports = {
  getCropInfo
};
