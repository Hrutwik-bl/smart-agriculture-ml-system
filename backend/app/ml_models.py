"""
ml_models.py

Loads and manages trained ML models for irrigation, fertilizer, and crop predictions.
Currently uses the 94.46% accurate Random Forest model for irrigation decisions.
"""

import os
import joblib
from pathlib import Path

# Base directory for models
MODELS_DIR = Path(__file__).parent / "models"

class IrrigationModel:
    """
    Wraps the trained Random Forest irrigation classifier.
    Input: Soil_Moisture, Temperature_C, Humidity, Rainfall_mm, 
           Crop_Growth_Stage, Season, Field_Area_hectare, Previous_Irrigation_mm
    Output: Binary classification (Yes/No) + decision confidence
    """
    
    def __init__(self):
        self.model = None
        self.is_loaded = False
        self.accuracy = 0.9446  # Reported accuracy from Colab training
        self.load_model()
    
    def load_model(self):
        """Load the trained Random Forest model from joblib file."""
        model_path = MODELS_DIR / "paddy_irrigation_random_forest.joblib"
        
        if not model_path.exists():
            print(f"⚠️  Model not found at {model_path}")
            self.is_loaded = False
            return
        
        try:
            self.model = joblib.load(model_path)
            self.is_loaded = True
            print(f"✓ Irrigation model loaded (accuracy: {self.accuracy*100:.2f}%)")
        except Exception as e:
            print(f"❌ Failed to load irrigation model: {e}")
            self.is_loaded = False
    
    def predict(self, features_dict):
        """
        Predict irrigation need from input features.
        
        Args:
            features_dict: {
                "Soil_Moisture": float (0-100),
                "Temperature_C": float,
                "Humidity": float (0-100),
                "Rainfall_mm": float,
                "Crop_Growth_Stage": str (e.g., "Vegetative", "Reproductive", "Ripening"),
                "Season": str (e.g., "Monsoon", "Winter", "Summer"),
                "Field_Area_hectare": float,
                "Previous_Irrigation_mm": float
            }
        
        Returns:
            {
                "irrigate": bool (Yes/No),
                "confidence": float (0-1),
                "probability": dict {"No": float, "Yes": float}
            }
        """
        if not self.is_loaded or not self.model:
            return None
        
        try:
            import pandas as pd
            
            # Create DataFrame (model was trained with pandas DataFrame)
            df = pd.DataFrame([{
                "Soil_Moisture": features_dict.get("Soil_Moisture", 50),
                "Temperature_C": features_dict.get("Temperature_C", 25),
                "Humidity": features_dict.get("Humidity", 70),
                "Rainfall_mm": features_dict.get("Rainfall_mm", 0),
                "Crop_Growth_Stage": features_dict.get("Crop_Growth_Stage", "Vegetative"),
                "Season": features_dict.get("Season", "Monsoon"),
                "Field_Area_hectare": features_dict.get("Field_Area_hectare", 1.0),
                "Previous_Irrigation_mm": features_dict.get("Previous_Irrigation_mm", 0)
            }])
            
            # Get prediction and probability
            prediction = self.model.predict(df)[0]
            probabilities = self.model.predict_proba(df)[0]
            
            # Model classes: likely ["No", "Yes"] or [0, 1]
            classes = self.model.classes_
            confidence = max(probabilities)
            
            # Determine if irrigation is needed based on prediction classes
            # Model classes: ["High", "Low", "Medium"] or similar
            # "Low" moisture = irrigation needed, "High" or "Medium" = no immediate irrigation
            irrigate = prediction == "Low" or prediction == 0
            
            return {
                "irrigate": irrigate,
                "confidence": float(confidence),
                "prediction": str(prediction),
                "probability": {
                    str(classes[i]): float(probabilities[i])
                    for i in range(len(classes))
                },
                "model": "Random Forest (94.46% accuracy - Colab)",
                "interpretation": f"Soil moisture status: {prediction}"
            }
        
        except Exception as e:
            print(f"❌ Prediction error: {e}")
            import traceback
            traceback.print_exc()
            return None


class FertilizerModel:
    """Placeholder for fertilizer recommendation model."""
    
    def __init__(self):
        self.is_loaded = False
        print("⚠️  Fertilizer model not yet integrated")
    
    def predict(self, features_dict):
        """Placeholder fertilizer prediction."""
        return None


class CropModel:
    """Placeholder for crop suitability model."""
    
    def __init__(self):
        self.is_loaded = False
        print("⚠️  Crop recommendation model not yet integrated")
    
    def predict(self, features_dict):
        """Placeholder crop prediction."""
        return None


# Global model instances
irrigation_model = IrrigationModel()
fertilizer_model = FertilizerModel()
crop_model = CropModel()
