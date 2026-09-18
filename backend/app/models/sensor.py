from sqlalchemy import Column, Integer, Float, DateTime
from sqlalchemy.sql import func

from app.database.database import Base


class SensorData(Base):
    __tablename__ = "sensor_data"

    id = Column(Integer, primary_key=True, index=True)

    soil_moisture = Column(Float, nullable=False)

    temperature = Column(Float, nullable=False)

    humidity = Column(Float, nullable=False)

    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )