---
name: iot-smart-irrigation-frontend-first
description: 'Restructure a smart agriculture project into a lightweight IoT-based smart irrigation architecture without breaking the existing frontend. Use when preserving current UI, parking legacy CSV data, building a dashboard prototype with dummy sensor values, and sequencing later ESP32, Raspberry Pi, ML, and backend integration.'
argument-hint: 'Provide current structure, files to keep, files to move, and prototype dashboard fields'
user-invocable: true
---

# IoT Smart Irrigation Frontend-First Workflow

## Outcome
Create a clean, lightweight project shape for an IoT-based smart irrigation system while preserving the existing frontend, then produce a prototype dashboard using dummy sensor values that can be demoed immediately.

Project title target:
IoT Based Smart Irrigation System for Precision Agriculture using Machine Learning.

## Use When
- The project has a working frontend that must be retained.
- The team has time pressure and needs a demoable prototype first.
- IoT and ML integration will be implemented in later phases.
- You want minimal file sprawl (1-2 files per major component initially).

## Inputs To Collect
- Current folder structure.
- Files/folders to keep untouched.
- Files/folders to delete.
- Files/folders to move into archive folder.
- Required final lightweight structure.
- Required dashboard sections and dummy values.

## Procedure

### 1. Freeze Critical Assets (Do Not Remove)
1. Confirm and preserve:
- Existing frontend HTML templates
- frontend static style.css
- frontend static dashboard.js
- frontend static images
- login and signup UI
- map or location UI
- existing backend folders
- ml_service
- package.json
2. If any required file appears missing, stop deletion/moves and report mismatch first.

Completion check:
- All preserved files still exist after cleanup.

### 2. Minimal Cleanup and Archive
1. Delete only transient Python cache folders:
- __pycache__/
2. Create old_data/ if missing.
3. Move legacy CSV files to old_data/ (do not delete):
- datafile.csv
- datafile (1).csv
- datafile (2).csv
- datafile (3).csv
- download.csv
- produce.csv

Completion check:
- old_data/ contains all listed CSV files.
- Root no longer contains those CSV files.
- No preserved frontend/backend assets were removed.

### 3. Normalize Lightweight Structure
Target structure:

- frontend/static/images/
- frontend/static/style.css
- frontend/static/dashboard.js
- frontend/static/auth.js
- frontend/templates/index.html
- frontend/templates/login.html
- frontend/templates/signup.html
- frontend/templates/dashboard.html
- server/
- ml_service/app.py
- ml_service/requirements.txt
- esp32/sensor_node.ino
- raspberry_pi/main.py
- old_data/
- package.json
- README.md

Rules:
- Keep only 1-2 files per major component at this stage.
- If an equivalent existing file already serves the same purpose, reuse instead of creating duplicates.

Completion check:
- Required folders exist.
- No unnecessary parallel file variants for the same role.

### 4. Frontend-Only Prototype (No Backend/ML Work Yet)
1. Update dashboard UI to reflect this flow:
- Smart Irrigation System
- Crop (Paddy)
- Location and growth stage
- Live sensor dashboard
- Irrigation decision
- Nutrient or fertilizer recommendation
- Pump status
2. Wire dummy data in dashboard logic.
3. Use auto-refresh simulated values every few seconds for demo realism, while keeping values bounded and understandable.
4. Keep authentication behavior in auth.js (login/signup/password toggle behavior).
5. Do not implement real API wiring in this phase.

Suggested dummy values:
- Soil Moisture: 38%
- Temperature: 28C
- Humidity: 72%
- Nitrogen: Low
- Phosphorus: Normal
- Potassium: High
- Rainfall: 2.4 mm
- Irrigation: REQUIRED
- Duration: 8 minutes
- Pump: OFF
- Mode: AUTO

Completion check:
- Dashboard renders with all required sections and sample values.
- Frontend remains stable on desktop and mobile.
- No backend or ML dependency needed to run the demo.

### 5. Defer Integration in Explicit Order
Do not implement in this skill execution unless explicitly requested.
Planned order:
1. Dataset and ML preparation
2. ESP32 sensor node
3. Raspberry Pi bridge and pump control
4. Backend endpoints and orchestration
5. End-to-end integration to frontend

## Decision Branches
- If frontend files conflict with target names:
  - Prefer rename/mapping over rewrite.
- If duplicate templates exist (landing vs index):
  - Keep the existing working behavior.
  - Only map landing to index if that mapping already exists in current project flow.
  - If not already mapped, do not force a rename or route change in this phase.
- If auth logic is split across multiple files:
  - Consolidate progressively into auth.js, but do not break current UX.
- If archive files are referenced by runtime code:
  - Update references before moving files.

## Quality Criteria
- Preservation-first: existing UI and assets still work.
- Lightweight architecture: no unnecessary file explosion.
- Demo-first behavior: dashboard works with dummy telemetry.
- Future-ready seams: clear handoff points for IoT and ML integration.

## Ready-to-Use Prompts
- Restructure this repo with preserve-first cleanup and move legacy CSV files into old_data only.
- Update dashboard to the IoT smart irrigation prototype using dummy sensor values and keep backend untouched.
- Validate that frontend-only prototype is demo-ready and list what remains for ESP32/Raspberry Pi/ML integration.
