# Smart Agriculture UI

Farmer-friendly UI with a **Node/Express backend** and a cinematic agriculture design.

## What this system does
- Landing page, login, signup, and dashboard UI
- Multi-language UI labels
- Secure signup/login using hashed passwords stored locally in JSON
- Location map picker with reverse geocoding

## Project structure

```text
smart-agriculture-ml/
├── frontend/
│   ├── templates/
│   ├── static/
├── server/
│   ├── i18n.js
├── data/
│   ├── users.json
├── server.js
├── package.json
├── README.md
└── .gitignore
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm start
```

3. Open in browser:

```text
http://127.0.0.1:5000
```

## Notes
- Login/signup credentials are stored in `data/users.json` (hashed via bcryptjs).
- Reverse geocoding uses OpenStreetMap Nominatim.

## Backend APIs

All endpoints return JSON and support GET (query params) or POST (JSON body):

- `POST /crop-prediction`
- `POST /irrigation`
- `GET /weather-alerts?location=`
- `POST /soil-health`
- `GET /price-prediction?crop=&location=&state=`
- `GET /market-trends?location=`

Example payload for crop prediction:

```json
{
	"location": "Pune",
	"season": "Kharif",
	"soil": {
		"n": 60,
		"p": 42,
		"k": 43,
		"ph": 6.4,
		"temperature": 28,
		"humidity": 70,
		"rainfall": 140
	}
}
```

## Environment variables

Create a `.env` file (optional) and set:

- `OPENWEATHER_API_KEY` (required for weather alerts + live irrigation data)
- `DATA_GOV_API_KEY` (required if using Agmarknet data.gov.in APIs)
- `AGMARKNET_RESOURCE_ID` (Agmarknet resource ID from data.gov.in)
- `SOIL_HEALTH_API_KEY` (optional; defaults to DATA_GOV_API_KEY if not set)
- `SOIL_HEALTH_RESOURCE_ID` (soil health card resource ID from data.gov.in)
- `ML_SERVICE_URL` (Python ML microservice base URL)
- `ML_SERVICE_PREDICT_PATH` (override ML endpoint path, default `/crop-prediction`)
- `MONGODB_URI` (optional)
- `DEMO_MODE=true` (default true; uses mock pricing/trends when datasets are missing)

## Dataset requirements

If you have datasets, place them in `data/` and set paths:

- `CROP_RECOMMENDATION_CSV_PATH` (crop recommendation dataset)
- `SOIL_HEALTH_CSV_PATH` (soil health card dataset)
- `CROP_PRICE_CSV_PATH` (Agmarknet price history)

If these files are missing and `DEMO_MODE=true`, the backend falls back to fast rule-based or mock outputs.

## Python ML microservice (FastAPI)

Use the included [ml_service/app.py](ml_service/app.py) FastAPI service (or create your own). It exposes
`/predict-crop` and `/crop-prediction`. Point Node to it via `ML_SERVICE_URL` and optionally
`ML_SERVICE_PREDICT_PATH=/predict-crop`.

Install:

```bash
pip install fastapi uvicorn scikit-learn pandas
```

Minimal app (example):

```python
from fastapi import FastAPI
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

app = FastAPI()

data = pd.read_csv("crop_recommendation.csv")
X = data.drop("label", axis=1)
y = data["label"]

model = RandomForestClassifier()
model.fit(X, y)

@app.post("/predict-crop")
def predict_crop(input_data: dict):
	features = [[
		input_data["N"],
		input_data["P"],
		input_data["K"],
		input_data["temperature"],
		input_data["humidity"],
		input_data["ph"],
		input_data["rainfall"],
	]]
	prediction = model.predict(features)
	return {"recommended_crop": prediction[0]}
```

Run:

```bash
uvicorn app:app --reload
```
