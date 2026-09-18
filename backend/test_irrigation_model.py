#!/usr/bin/env python3
"""
test_irrigation_model.py - Test the integrated ML model
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8000"

# Test 1: Check model status
print("=" * 60)
print("TEST 1: Model Status")
print("=" * 60)

response = requests.get(f"{BASE_URL}/api/predict-irrigation/status")
print(json.dumps(response.json(), indent=2))

# Test 2: Make prediction with LOW soil moisture (should irrigate)
print("\n" + "=" * 60)
print("TEST 2: Prediction with LOW soil moisture (35%)")
print("=" * 60)

payload_low_moisture = {
    "Soil_Moisture": 35,
    "Temperature_C": 28,
    "Humidity": 75,
    "Rainfall_mm": 5,
    "Crop_Growth_Stage": "Vegetative",
    "Season": "Monsoon",
    "Field_Area_hectare": 1.5,
    "Previous_Irrigation_mm": 10
}

response = requests.post(f"{BASE_URL}/api/predict-irrigation", json=payload_low_moisture)
result = response.json()
print(json.dumps(result, indent=2))

# Test 3: Make prediction with HIGH soil moisture (should NOT irrigate)
print("\n" + "=" * 60)
print("TEST 3: Prediction with HIGH soil moisture (75%)")
print("=" * 60)

payload_high_moisture = {
    "Soil_Moisture": 75,
    "Temperature_C": 25,
    "Humidity": 80,
    "Rainfall_mm": 20,
    "Crop_Growth_Stage": "Reproductive",
    "Season": "Winter",
    "Field_Area_hectare": 2.0,
    "Previous_Irrigation_mm": 25
}

response = requests.post(f"{BASE_URL}/api/predict-irrigation", json=payload_high_moisture)
result = response.json()
print(json.dumps(result, indent=2))

print("\n" + "=" * 60)
print("✓ ALL TESTS COMPLETED")
print("=" * 60)
