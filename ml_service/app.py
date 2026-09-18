"""
Smart Irrigation ML Service — FastAPI
======================================
Three prediction endpoints:

  POST /predict-irrigation
      Input : soilMoisture, temperature, humidity, nitrogen, phosphorus,
              potassium, rainfall24h
      Output: irrigate (bool), waterRequirementMm, confidence, model

  POST /predict-fertilizer
      Input : nitrogen, phosphorus, potassium, temperature, humidity
      Output: npkStatus, fertilizers[], priority, actionRequired,
              recommendation, confidence

  POST /predict-crop  (kept for compatibility)
      Input : N, P, K, temperature, humidity, ph, rainfall
      Output: recommendations[], recommended_crop

Run:
  uvicorn app:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import os
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import LabelEncoder
import joblib

app = FastAPI(title="Smart Irrigation ML Service", version="2.0.0")

# ── Model registry ────────────────────────────────────────────────────────────

_irrigation_clf  = None   # RandomForestClassifier  → irrigate yes/no
_irrigation_reg  = None   # GradientBoostingRegressor → water requirement (mm)
_fertilizer_clf  = None   # RandomForestClassifier  → fertilizer class
_crop_clf        = None   # RandomForestClassifier  → crop suitability
_crop_classes    = None

# ── Paddy thresholds (used by rule-based helpers and model fallbacks) ─────────

PADDY_MOISTURE_LOW  = float(os.getenv("PADDY_SOIL_MOISTURE_LOW",  "40"))
PADDY_MOISTURE_HIGH = float(os.getenv("PADDY_SOIL_MOISTURE_HIGH", "70"))

# ── Dataset helpers ───────────────────────────────────────────────────────────

def _find_csv(*candidates: str) -> str | None:
    for path in candidates:
        if path and os.path.exists(path):
            return path
    return None


# ─────────────────────────────────────────────────────────────────────────────
# 1.  IRRIGATION MODEL
# ─────────────────────────────────────────────────────────────────────────────

IRRIGATION_FEATURES = [
    "soilMoisture", "temperature", "humidity",
    "nitrogen", "phosphorus", "potassium", "rainfall24h",
]

def _train_or_load_irrigation():
    """
    Try to load a pre-saved model from disk. If not found, train a synthetic
    model based on domain rules (paddy agronomy knowledge) so the service
    works out-of-the-box without a dataset.

    To use a real dataset, place a CSV with columns:
      soilMoisture, temperature, humidity, nitrogen, phosphorus, potassium,
      rainfall24h, irrigate (0/1), waterRequirementMm
    and set IRRIGATION_CSV_PATH in the environment.
    """
    global _irrigation_clf, _irrigation_reg

    clf_path = os.getenv("IRRIGATION_CLF_PATH", "models/irrigation_clf.pkl")
    reg_path = os.getenv("IRRIGATION_REG_PATH", "models/irrigation_reg.pkl")

    if os.path.exists(clf_path) and os.path.exists(reg_path):
        _irrigation_clf = joblib.load(clf_path)
        _irrigation_reg = joblib.load(reg_path)
        print("[ML] Loaded irrigation models from disk.")
        return

    csv_path = _find_csv(
        os.getenv("IRRIGATION_CSV_PATH", ""),
        "data/irrigation.csv",
        "../data/irrigation.csv",
    )

    if csv_path:
        df = pd.read_csv(csv_path)
        X  = df[IRRIGATION_FEATURES].values
        y_clf = df["irrigate"].astype(int).values
        y_reg = df["waterRequirementMm"].values

        _irrigation_clf = RandomForestClassifier(n_estimators=200, random_state=42)
        _irrigation_clf.fit(X, y_clf)

        _irrigation_reg = GradientBoostingRegressor(n_estimators=200, random_state=42)
        _irrigation_reg.fit(X, y_reg)
        print(f"[ML] Trained irrigation models from {csv_path}.")
    else:
        # Synthetic training data derived from paddy agronomy rules
        print("[ML] No irrigation dataset found — generating synthetic training data.")
        rng  = np.random.default_rng(42)
        n    = 5000

        sm   = rng.uniform(15,  90,  n)   # soilMoisture %
        temp = rng.uniform(18,  42,  n)   # temperature °C
        hum  = rng.uniform(40,  95,  n)   # humidity %
        nit  = rng.uniform(20,  250, n)   # nitrogen mg/kg
        pho  = rng.uniform(10,  80,  n)   # phosphorus mg/kg
        pot  = rng.uniform(50,  300, n)   # potassium mg/kg
        rain = rng.uniform(0,   30,  n)   # rainfall24h mm

        # Rule: irrigate if soil moisture < 40 AND expected rain < 10 mm
        irrigate = ((sm < PADDY_MOISTURE_LOW) & (rain < 10)).astype(int)

        # Water requirement: simplified Penman–Monteith
        base     = 4.0
        t_factor = np.maximum(0, (temp - 25) * 0.18)
        h_factor = np.maximum(0, (50 - hum)  * 0.02)
        r_offset = np.minimum(4, rain / 10)
        req      = np.maximum(0.5, base + t_factor + h_factor - r_offset)
        req      = np.where(irrigate == 0, 0, req)

        X = np.column_stack([sm, temp, hum, nit, pho, pot, rain])

        _irrigation_clf = RandomForestClassifier(n_estimators=200, random_state=42)
        _irrigation_clf.fit(X, irrigate)

        _irrigation_reg = GradientBoostingRegressor(n_estimators=200, random_state=42)
        _irrigation_reg.fit(X, req)
        print("[ML] Irrigation models trained on synthetic data.")

    # Persist for next restart
    os.makedirs("models", exist_ok=True)
    joblib.dump(_irrigation_clf, clf_path)
    joblib.dump(_irrigation_reg, reg_path)


def _ensure_irrigation():
    if _irrigation_clf is None:
        _train_or_load_irrigation()


# ─────────────────────────────────────────────────────────────────────────────
# 2.  FERTILIZER / NPK MODEL
# ─────────────────────────────────────────────────────────────────────────────

FERTILIZER_FEATURES = ["nitrogen", "phosphorus", "potassium", "temperature", "humidity"]

# Fertilizer class labels (what the model predicts)
FERTILIZER_LABELS = [
    "No_Application",
    "Urea",
    "DAP",
    "MOP",
    "Urea_DAP",
    "Urea_MOP",
    "DAP_MOP",
    "Urea_DAP_MOP",
]

_fertilizer_le = LabelEncoder()
_fertilizer_le.fit(FERTILIZER_LABELS)

def _train_or_load_fertilizer():
    global _fertilizer_clf

    path = os.getenv("FERTILIZER_CLF_PATH", "models/fertilizer_clf.pkl")

    if os.path.exists(path):
        _fertilizer_clf = joblib.load(path)
        print("[ML] Loaded fertilizer model from disk.")
        return

    csv_path = _find_csv(
        os.getenv("FERTILIZER_CSV_PATH", ""),
        "data/fertilizer.csv",
        "../data/fertilizer.csv",
    )

    if csv_path:
        df = pd.read_csv(csv_path)
        X  = df[FERTILIZER_FEATURES].values
        y  = df["fertilizer_class"].values
        _fertilizer_clf = RandomForestClassifier(n_estimators=200, random_state=42)
        _fertilizer_clf.fit(X, y)
        print(f"[ML] Trained fertilizer model from {csv_path}.")
    else:
        print("[ML] No fertilizer dataset — generating synthetic training data.")
        rng = np.random.default_rng(99)
        n   = 5000

        nit  = rng.uniform(20,  250, n)
        pho  = rng.uniform(10,  80,  n)
        pot  = rng.uniform(50,  300, n)
        temp = rng.uniform(18,  42,  n)
        hum  = rng.uniform(40,  95,  n)

        # Assign label based on deficiency rules
        def label(i):
            n_low = nit[i] < 80
            p_low = pho[i] < 20
            k_low = pot[i] < 100
            if n_low and p_low and k_low: return "Urea_DAP_MOP"
            if n_low and p_low:           return "Urea_DAP"
            if n_low and k_low:           return "Urea_MOP"
            if p_low and k_low:           return "DAP_MOP"
            if n_low:                     return "Urea"
            if p_low:                     return "DAP"
            if k_low:                     return "MOP"
            return "No_Application"

        y = np.array([label(i) for i in range(n)])
        X = np.column_stack([nit, pho, pot, temp, hum])

        _fertilizer_clf = RandomForestClassifier(n_estimators=200, random_state=42)
        _fertilizer_clf.fit(X, y)
        print("[ML] Fertilizer model trained on synthetic data.")

    os.makedirs("models", exist_ok=True)
    joblib.dump(_fertilizer_clf, path)


def _ensure_fertilizer():
    if _fertilizer_clf is None:
        _train_or_load_fertilizer()


# ─────────────────────────────────────────────────────────────────────────────
# 3.  CROP SUITABILITY MODEL (existing, kept for compatibility)
# ─────────────────────────────────────────────────────────────────────────────

CROP_FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]

def _find_crop_csv():
    return _find_csv(
        os.getenv("CROP_RECOMMENDATION_CSV_PATH", ""),
        "crop_recommendation.csv",
        "../data/crop_recommendation.csv",
        "data/crop_recommendation.csv",
    )

def _train_or_load_crop():
    global _crop_clf, _crop_classes

    path = os.getenv("CROP_CLF_PATH", "models/crop_clf.pkl")
    if os.path.exists(path):
        _crop_clf    = joblib.load(path)
        _crop_classes = list(_crop_clf.classes_)
        print("[ML] Loaded crop model from disk.")
        return

    csv_path = _find_crop_csv()
    if not csv_path:
        raise FileNotFoundError("Crop recommendation CSV not found. Set CROP_RECOMMENDATION_CSV_PATH.")

    df  = pd.read_csv(csv_path)
    missing = [c for c in CROP_FEATURES + ["label"] if c not in df.columns]
    if missing:
        raise ValueError(f"Crop CSV is missing columns: {', '.join(missing)}")

    X = df[CROP_FEATURES].values
    y = df["label"].values

    _crop_clf = RandomForestClassifier(n_estimators=200, random_state=42)
    _crop_clf.fit(X, y)
    _crop_classes = list(_crop_clf.classes_)

    os.makedirs("models", exist_ok=True)
    joblib.dump(_crop_clf, path)
    print(f"[ML] Trained crop model from {csv_path}.")


def _ensure_crop():
    if _crop_clf is None:
        _train_or_load_crop()


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────────────────────

class IrrigationInput(BaseModel):
    soilMoisture: float = Field(..., ge=0,   le=100,  description="Soil moisture (%)")
    temperature:  float = Field(..., ge=-10, le=60,   description="Air temperature (°C)")
    humidity:     float = Field(..., ge=0,   le=100,  description="Relative humidity (%)")
    nitrogen:     float = Field(..., ge=0,             description="Nitrogen (mg/kg)")
    phosphorus:   float = Field(..., ge=0,             description="Phosphorus (mg/kg)")
    potassium:    float = Field(..., ge=0,             description="Potassium (mg/kg)")
    rainfall24h:  float = Field(0.0, ge=0,            description="Expected rainfall next 24 h (mm)")


class FertilizerInput(BaseModel):
    nitrogen:    float = Field(..., ge=0, description="Nitrogen (mg/kg)")
    phosphorus:  float = Field(..., ge=0, description="Phosphorus (mg/kg)")
    potassium:   float = Field(..., ge=0, description="Potassium (mg/kg)")
    temperature: float = Field(28.0, description="Air temperature (°C)")
    humidity:    float = Field(70.0, description="Relative humidity (%)")


class CropInput(BaseModel):
    N:           float
    P:           float
    K:           float
    temperature: float
    humidity:    float
    ph:          float
    rainfall:    float


# ─────────────────────────────────────────────────────────────────────────────
# Helper: NPK deficiency labels
# ─────────────────────────────────────────────────────────────────────────────

def _npk_status(n, p, k):
    def s(v, low, high):
        if v < low:  return "LOW"
        if v > high: return "HIGH"
        return "NORMAL"
    return {
        "nitrogen":   s(n, 80,  200),
        "phosphorus": s(p, 20,  50),
        "potassium":  s(k, 100, 250),
    }


_FERTILIZER_PRODUCTS = {
    "Urea":        {"product": "Urea (46-0-0)",         "dosageKgPerHa": 50},
    "DAP":         {"product": "DAP (18-46-0)",          "dosageKgPerHa": 30},
    "MOP":         {"product": "MOP / KCl (0-0-60)",     "dosageKgPerHa": 40},
    "No_Application": None,
}

def _fertilizer_apps(label: str):
    parts = label.split("_")
    apps  = []
    for p in parts:
        info = _FERTILIZER_PRODUCTS.get(p)
        if info:
            apps.append(info)
    return apps


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
def _startup():
    """Pre-train all models on startup so first request is fast."""
    try:
        _train_or_load_irrigation()
    except Exception as e:
        print(f"[ML] WARNING: irrigation model failed to load: {e}")
    try:
        _train_or_load_fertilizer()
    except Exception as e:
        print(f"[ML] WARNING: fertilizer model failed to load: {e}")
    # Crop model is optional — only load if dataset available
    try:
        _train_or_load_crop()
    except FileNotFoundError:
        print("[ML] Crop dataset not available — /predict-crop will return 503.")
    except Exception as e:
        print(f"[ML] WARNING: crop model failed to load: {e}")


@app.post("/predict-irrigation")
def predict_irrigation(data: IrrigationInput):
    _ensure_irrigation()
    X = [[
        data.soilMoisture, data.temperature, data.humidity,
        data.nitrogen, data.phosphorus, data.potassium, data.rainfall24h,
    ]]

    irrigate_prob = _irrigation_clf.predict_proba(X)[0]
    irrigate_cls  = int(_irrigation_clf.predict(X)[0])
    water_req     = float(max(0.0, _irrigation_reg.predict(X)[0]))
    confidence    = round(float(irrigate_prob[irrigate_cls]), 3)

    reason = (
        f"Soil moisture {data.soilMoisture}% is below {PADDY_MOISTURE_LOW}% threshold"
        if irrigate_cls == 1 and data.soilMoisture < PADDY_MOISTURE_LOW
        else "Soil moisture is adequate — no irrigation required"
        if irrigate_cls == 0
        else "ML model recommends irrigation based on combined sensor data"
    )

    return {
        "irrigate":           bool(irrigate_cls),
        "waterRequirementMm": round(water_req, 2),
        "durationMinutes":    round(water_req / 0.5) if irrigate_cls else 0,
        "confidence":         confidence,
        "reason":             reason,
        "model":              "RandomForest+GBR",
    }


@app.post("/predict-fertilizer")
def predict_fertilizer(data: FertilizerInput):
    _ensure_fertilizer()
    X     = [[data.nitrogen, data.phosphorus, data.potassium, data.temperature, data.humidity]]
    proba = _fertilizer_clf.predict_proba(X)[0]
    label = _fertilizer_clf.predict(X)[0]
    conf  = round(float(proba.max()), 3)

    npk_st = _npk_status(data.nitrogen, data.phosphorus, data.potassium)
    apps   = _fertilizer_apps(str(label))
    action = label != "No_Application"

    priority = "HIGH" if len(apps) >= 2 else "MEDIUM" if len(apps) == 1 else "LOW"

    summary = (
        f"Apply: {', '.join(a['product'] for a in apps)} within 3–5 days"
        if apps else
        "NPK levels are adequate — no fertilizer application needed now"
    )

    return {
        "label":          label,
        "npkStatus":      npk_st,
        "fertilizers":    apps,
        "actionRequired": action,
        "priority":       priority,
        "recommendation": summary,
        "confidence":     conf,
        "model":          "RandomForest-NPK",
    }


@app.post("/predict-crop")
@app.post("/crop-prediction")   # legacy alias
def predict_crop(data: CropInput):
    try:
        _ensure_crop()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    X     = [[data.N, data.P, data.K, data.temperature, data.humidity, data.ph, data.rainfall]]
    proba = _crop_clf.predict_proba(X)[0]

    ranked = sorted(zip(_crop_classes, proba), key=lambda x: x[1], reverse=True)[:3]
    recommendations = [
        {"crop": c, "score": round(float(s), 3), "reason": "ML model recommendation"}
        for c, s in ranked
    ]
    return {
        "recommendations":  recommendations,
        "recommended_crop": recommendations[0]["crop"] if recommendations else None,
    }


@app.get("/health")
def health():
    return {
        "status":     "ok",
        "irrigation": _irrigation_clf is not None,
        "fertilizer": _fertilizer_clf is not None,
        "crop":       _crop_clf       is not None,
    }
