from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.database import Base, engine
from app.models.sensor import SensorData
from app.routes.sensor import router as sensor_router
from app.routes.irrigation import router as irrigation_router
from app.ml_models import irrigation_model


# Create database tables
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Smart Irrigation System",
    description="ML-based Smart Irrigation Backend with 94.46% accurate Random Forest model",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include ML model routers
app.include_router(sensor_router)
app.include_router(irrigation_router)


@app.get("/")
def home():
    return {
        "message": "Smart Irrigation Backend is running"
    }