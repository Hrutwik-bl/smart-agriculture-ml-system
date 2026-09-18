#!/usr/bin/env python3
"""
Raspberry Pi Controller — Smart Irrigation System
===================================================
Responsibilities:
  1. Receive sensor data from ESP32 (HTTP POST from ESP32's Wi-Fi client)
  2. Forward sensor data to the Node.js backend (/api/sensor/ingest)
  3. Call ML service to get irrigation and fertilizer decisions
  4. Control the relay (pump ON/OFF) via GPIO based on the ML decision
  5. Poll the Node.js backend for pump commands from the dashboard

Hardware:
  - Raspberry Pi 4
  - 1-Channel Relay Module on GPIO pin 17 (BCM numbering)
    Relay IN  → GPIO 17
    Relay VCC → 5V
    Relay GND → GND
    Pump is wired through the relay (separate power supply for pump!)

Run:
  python3 main.py

Install dependencies:
  pip3 install requests RPi.GPIO flask

Environment variables (or set them in this file):
  NODE_API_URL      — Node.js backend URL  (default: http://localhost:5000)
  ML_SERVICE_URL    — FastAPI ML service URL (default: http://localhost:8000)
  DEVICE_SECRET     — shared secret with Node.js (default: iot-device-secret-change-in-prod)
  RELAY_GPIO_PIN    — BCM pin number for relay (default: 17)
  POLLING_INTERVAL  — seconds between pump-status polls (default: 10)
"""

import os
import sys
import time
import json
import logging
import threading
import requests
from flask import Flask, request, jsonify

# ── Try to import RPi.GPIO; fall back to a mock in dev/test environments ───────
try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False
    print("[GPIO] RPi.GPIO not available — running in simulation mode")

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
NODE_API_URL     = os.getenv("NODE_API_URL",     "http://localhost:5000")
ML_SERVICE_URL   = os.getenv("ML_SERVICE_URL",   "http://localhost:8000")
DEVICE_SECRET    = os.getenv("DEVICE_SECRET",    "iot-device-secret-change-in-prod")
RELAY_GPIO_PIN   = int(os.getenv("RELAY_GPIO_PIN",   "17"))
POLLING_INTERVAL = int(os.getenv("POLLING_INTERVAL", "10"))
LISTEN_PORT      = int(os.getenv("LISTEN_PORT",      "8080"))

# ── GPIO setup ────────────────────────────────────────────────────────────────

def gpio_setup():
    if not GPIO_AVAILABLE:
        return
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(RELAY_GPIO_PIN, GPIO.OUT, initial=GPIO.HIGH)  # HIGH = relay OFF (active-low)
    log.info(f"[GPIO] Relay pin {RELAY_GPIO_PIN} initialised (HIGH = OFF)")


def gpio_pump_on():
    if GPIO_AVAILABLE:
        GPIO.output(RELAY_GPIO_PIN, GPIO.LOW)   # Active-low relay: LOW = ON
        log.info("[GPIO] Pump → ON  (relay closed)")
    else:
        log.info("[GPIO] [SIM] Pump → ON")


def gpio_pump_off():
    if GPIO_AVAILABLE:
        GPIO.output(RELAY_GPIO_PIN, GPIO.HIGH)  # HIGH = OFF
        log.info("[GPIO] Pump → OFF (relay open)")
    else:
        log.info("[GPIO] [SIM] Pump → OFF")


def gpio_cleanup():
    if GPIO_AVAILABLE:
        GPIO.cleanup()
        log.info("[GPIO] Cleanup done")


# ── HTTP helpers ──────────────────────────────────────────────────────────────

HEADERS_JSON   = {"Content-Type": "application/json"}
HEADERS_DEVICE = {**HEADERS_JSON, "X-Device-Secret": DEVICE_SECRET}

def _post(url: str, payload: dict, headers: dict, timeout: int = 8) -> dict | None:
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.RequestException as exc:
        log.warning(f"[HTTP] POST {url} failed: {exc}")
        return None


def _get(url: str, timeout: int = 8) -> dict | None:
    try:
        r = requests.get(url, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.RequestException as exc:
        log.warning(f"[HTTP] GET {url} failed: {exc}")
        return None


# ── Forward sensor data to Node.js + run ML ───────────────────────────────────

def forward_and_decide(sensor_payload: dict):
    """
    1. Forward the raw sensor reading to the Node.js backend.
    2. Call the ML service for an irrigation decision.
    3. If irrigation is needed, trigger the pump.
    4. Log the pump command back to Node.js.
    """
    log.info(f"[Pipeline] Sensor reading received: {sensor_payload}")

    # 1. Save sensor data to MongoDB via Node.js
    resp = _post(f"{NODE_API_URL}/api/sensor/ingest", sensor_payload, HEADERS_DEVICE)
    if resp and resp.get("success"):
        log.info("[Pipeline] Sensor data saved to MongoDB ✓")
    else:
        log.warning("[Pipeline] Failed to save sensor data to backend")

    # 2. Call ML service for irrigation decision
    irrigation_payload = {
        "soilMoisture": sensor_payload.get("soilMoisture", 50),
        "temperature":  sensor_payload.get("temperature",  28),
        "humidity":     sensor_payload.get("humidity",     70),
        "nitrogen":     sensor_payload.get("nitrogen",     100),
        "phosphorus":   sensor_payload.get("phosphorus",   30),
        "potassium":    sensor_payload.get("potassium",    150),
        "rainfall24h":  sensor_payload.get("rainfall24h",  0),
    }

    ml_resp = _post(f"{ML_SERVICE_URL}/predict-irrigation", irrigation_payload, HEADERS_JSON)
    if not ml_resp:
        log.warning("[Pipeline] ML service unavailable — skipping pump control this cycle")
        return

    irrigate       = ml_resp.get("irrigate", False)
    duration_min   = ml_resp.get("durationMinutes", 0)
    water_req_mm   = ml_resp.get("waterRequirementMm", 0)
    reason         = ml_resp.get("reason", "")

    log.info(f"[ML] irrigate={irrigate}, water={water_req_mm}mm, duration={duration_min}min, reason={reason}")

    # 3. Also trigger a fertilizer recommendation (fire-and-forget, non-blocking)
    threading.Thread(
        target=_post,
        args=(f"{NODE_API_URL}/api/fertilizer/predict",
              {"sensor": irrigation_payload}, HEADERS_JSON),
        daemon=True,
    ).start()

    # 4. Control the pump
    if irrigate and duration_min > 0:
        # Tell Node.js we're turning the pump ON
        _post(f"{NODE_API_URL}/api/pump/control",
              {"command": "ON", "reason": reason, "durationMinutes": duration_min,
               "triggeredBy": "raspberry-pi"},
              HEADERS_JSON)

        gpio_pump_on()
        log.info(f"[Pump] Irrigating for {duration_min} minutes...")

        time.sleep(duration_min * 60)  # Keep pump running for the required duration

        gpio_pump_off()
        _post(f"{NODE_API_URL}/api/pump/control",
              {"command": "OFF", "reason": "Irrigation complete", "triggeredBy": "raspberry-pi"},
              HEADERS_JSON)
        log.info("[Pump] Irrigation cycle complete")
    else:
        gpio_pump_off()
        log.info(f"[Pump] No irrigation needed: {reason}")


# ── Pump status polling ───────────────────────────────────────────────────────

_last_pump_command = "OFF"

def poll_pump_status():
    """
    Continuously poll Node.js for pump commands from the dashboard.
    This allows the farmer to manually override the pump via the web UI.
    """
    global _last_pump_command
    log.info("[Poll] Pump status polling started")

    while True:
        try:
            data = _get(f"{NODE_API_URL}/api/pump/status")
            if data and data.get("success"):
                cmd = data.get("data", {}).get("currentCommand", "OFF")
                if cmd != _last_pump_command:
                    log.info(f"[Poll] Pump command changed: {_last_pump_command} → {cmd}")
                    if cmd == "ON":
                        gpio_pump_on()
                    else:
                        gpio_pump_off()
                    _last_pump_command = cmd
        except Exception as exc:
            log.warning(f"[Poll] Exception: {exc}")

        time.sleep(POLLING_INTERVAL)


# ── Flask HTTP server (receives data from ESP32) ──────────────────────────────

flask_app = Flask(__name__)

@flask_app.route("/api/sensor/ingest", methods=["POST"])
def receive_from_esp32():
    """
    ESP32 POSTs sensor data here.
    The Raspberry Pi then forwards it to the Node.js backend and runs ML.
    """
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 400

    payload = request.get_json()

    # Basic validation
    required = ["soilMoisture", "temperature", "humidity", "nitrogen", "phosphorus", "potassium"]
    missing  = [f for f in required if f not in payload]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    # Run the full pipeline in a background thread so ESP32 gets an immediate 200
    threading.Thread(target=forward_and_decide, args=(payload,), daemon=True).start()

    return jsonify({"success": True, "message": "Sensor data received — processing"}), 200


@flask_app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":        "ok",
        "gpio":          GPIO_AVAILABLE,
        "relay_pin":     RELAY_GPIO_PIN,
        "pump_command":  _last_pump_command,
    })


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    gpio_setup()

    # Start pump-status polling in a background thread
    poll_thread = threading.Thread(target=poll_pump_status, daemon=True)
    poll_thread.start()

    log.info(f"[Main] Raspberry Pi controller starting on port {LISTEN_PORT}")
    log.info(f"[Main] Node.js backend : {NODE_API_URL}")
    log.info(f"[Main] ML service      : {ML_SERVICE_URL}")
    log.info(f"[Main] Relay GPIO pin  : {RELAY_GPIO_PIN}")

    try:
        flask_app.run(host="0.0.0.0", port=LISTEN_PORT, debug=False, use_reloader=False)
    finally:
        gpio_cleanup()
