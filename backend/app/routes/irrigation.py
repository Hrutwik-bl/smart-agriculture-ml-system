"""
irrigation.py

FastAPI routes for irrigation decisions.
Integrates the 94.46% accurate Random Forest model from Colab.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from app.ml_models import irrigation_model

router = APIRouter(prefix="/api", tags=["irrigation"])


class IrrigationInput(BaseModel):
    """Expected input for irrigation prediction."""
    Soil_Moisture: float  # % (0-100)
    Temperature_C: float  # Celsius
    Humidity: float  # % (0-100)
    Rainfall_mm: float  # mm
    Crop_Growth_Stage: str  # e.g., "Vegetative", "Reproductive", "Ripening"
    Season: str  # e.g., "Monsoon", "Winter", "Summer"
    Field_Area_hectare: Optional[float] = 1.0
    Previous_Irrigation_mm: Optional[float] = 0


class IrrigationOutput(BaseModel):
    """Irrigation decision output."""
    irrigate: bool
    confidence: float
    prediction: str
    probability: Dict[str, float]
    model: str
    message: str


@router.post("/predict-irrigation")
async def predict_irrigation(input_data: IrrigationInput):
    """
    Predict irrigation need using the trained Random Forest model.
    
    **Accuracy: 94.46%** (from Colab training)
    
    **Example Input:**
    ```json
    {
        "Soil_Moisture": 35,
        "Temperature_C": 28,
        "Humidity": 75,
        "Rainfall_mm": 5,
        "Crop_Growth_Stage": "Vegetative",
        "Season": "Monsoon",
        "Field_Area_hectare": 1.5,
        "Previous_Irrigation_mm": 10
    }
    ```
    """
    
    if not irrigation_model.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="Irrigation model not loaded. Check backend logs."
        )
    
    try:
        # Call the model
        result = irrigation_model.predict(input_data.dict())
        
        if result is None:
            raise HTTPException(
                status_code=500,
                detail="Model prediction failed"
            )
        
        # Generate human-readable message
        confidence_pct = result["confidence"] * 100
        stage = input_data.Crop_Growth_Stage
        season = input_data.Season
        
        if result["irrigate"]:
            message = (
                f"✓ IRRIGATION REQUIRED during {stage} in {season}. "
                f"Soil moisture ({input_data.Soil_Moisture}%) is below optimal. "
                f"Confidence: {confidence_pct:.1f}%"
            )
        else:
            message = (
                f"✗ NO IRRIGATION NEEDED. Soil moisture ({input_data.Soil_Moisture}%) "
                f"is sufficient for {stage} in {season}. "
                f"Confidence: {confidence_pct:.1f}%"
            )
        
        return IrrigationOutput(
            **result,
            message=message
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction error: {str(e)}"
        )


@router.get("/predict-irrigation/status")
async def model_status():
    """Check if irrigation model is loaded and ready."""
    return {
        "model_loaded": irrigation_model.is_loaded,
        "model_name": "Random Forest (Colab)",
        "accuracy": f"{irrigation_model.accuracy * 100:.2f}%",
        "features": [
            "Soil_Moisture",
            "Temperature_C",
            "Humidity",
            "Rainfall_mm",
            "Crop_Growth_Stage",
            "Season",
            "Field_Area_hectare",
            "Previous_Irrigation_mm"
        ]
    }
