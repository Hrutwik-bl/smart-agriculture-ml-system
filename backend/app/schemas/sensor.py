from pydantic import BaseModel, Field


class SensorDataCreate(BaseModel):
    soil_moisture: float = Field(..., ge=0, le=100)
    temperature: float
    humidity: float = Field(..., ge=0, le=100)