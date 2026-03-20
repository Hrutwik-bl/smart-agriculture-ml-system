from fastapi import FastAPI, HTTPException
import os
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

app = FastAPI()

MODEL = None
FEATURE_COLUMNS = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
CLASS_LABELS = None


def _find_dataset_path():
    env_path = os.getenv("CROP_RECOMMENDATION_CSV_PATH")
    if env_path and os.path.exists(env_path):
        return env_path
    candidates = [
        "crop_recommendation.csv",
        os.path.join("..", "data", "crop_recommendation.csv"),
        os.path.join("data", "crop_recommendation.csv"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def _load_model():
    global MODEL, CLASS_LABELS
    dataset_path = _find_dataset_path()
    if not dataset_path:
        raise FileNotFoundError("Crop recommendation dataset not found")

    data = pd.read_csv(dataset_path)
    if "label" not in data.columns:
        raise ValueError("Dataset must include a 'label' column")

    missing_cols = [col for col in FEATURE_COLUMNS if col not in data.columns]
    if missing_cols:
        raise ValueError(f"Dataset missing columns: {', '.join(missing_cols)}")

    X = data[FEATURE_COLUMNS]
    y = data["label"]

    model = RandomForestClassifier(n_estimators=200, random_state=42)
    model.fit(X, y)
    MODEL = model
    CLASS_LABELS = list(model.classes_)


def _ensure_model():
    if MODEL is None:
        _load_model()


def _build_feature_vector(payload):
    try:
        return [
            float(payload["N"]),
            float(payload["P"]),
            float(payload["K"]),
            float(payload["temperature"]),
            float(payload["humidity"]),
            float(payload["ph"]),
            float(payload["rainfall"]),
        ]
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Missing field: {exc.args[0]}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid numeric value") from exc


def _predict_top3(payload):
    _ensure_model()
    features = _build_feature_vector(payload)
    probabilities = MODEL.predict_proba([features])[0]
    ranked = sorted(
        zip(CLASS_LABELS, probabilities),
        key=lambda item: item[1],
        reverse=True
    )[:3]
    recommendations = [
        {
            "crop": crop,
            "score": round(float(score), 3),
            "reason": "ML model recommendation",
        }
        for crop, score in ranked
    ]
    return recommendations


@app.post("/crop-prediction")
def crop_prediction(input_data: dict):
    try:
        recommendations = _predict_top3(input_data)
        return {
            "recommendations": recommendations,
            "recommended_crop": recommendations[0]["crop"] if recommendations else None,
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/predict-crop")
def predict_crop(input_data: dict):
    return crop_prediction(input_data)
