from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.sensor import SensorData
from app.schemas.sensor import SensorDataCreate


router = APIRouter(
    prefix="/sensor",
    tags=["Sensor"]
)


# Create sensor data
@router.post("/")
def create_sensor_data(
    sensor: SensorDataCreate,
    db: Session = Depends(get_db)
):
    new_sensor_data = SensorData(
        soil_moisture=sensor.soil_moisture,
        temperature=sensor.temperature,
        humidity=sensor.humidity
    )

    db.add(new_sensor_data)
    db.commit()
    db.refresh(new_sensor_data)

    return {
        "message": "Sensor data saved successfully",
        "data": {
            "id": new_sensor_data.id,
            "soil_moisture": new_sensor_data.soil_moisture,
            "temperature": new_sensor_data.temperature,
            "humidity": new_sensor_data.humidity,
            "timestamp": new_sensor_data.timestamp
        }
    }


# Get all sensor data
@router.get("/")
def get_sensor_data(
    db: Session = Depends(get_db)
):
    sensor_data = (
        db.query(SensorData)
        .order_by(SensorData.timestamp.desc())
        .all()
    )

    return {
        "message": "Sensor data retrieved successfully",
        "count": len(sensor_data),
        "data": sensor_data
    }


# Get latest sensor data
@router.get("/latest")
def get_latest_sensor_data(
    db: Session = Depends(get_db)
):
    latest_data = (
        db.query(SensorData)
        .order_by(SensorData.timestamp.desc())
        .first()
    )

    if latest_data is None:
        return {
            "message": "No sensor data available"
        }

    return {
        "message": "Latest sensor data retrieved successfully",
        "data": {
            "id": latest_data.id,
            "soil_moisture": latest_data.soil_moisture,
            "temperature": latest_data.temperature,
            "humidity": latest_data.humidity,
            "timestamp": latest_data.timestamp
        }
    }