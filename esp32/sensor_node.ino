/**
 * sensor_node.ino — ESP32 Smart Irrigation Sensor Node
 * ======================================================
 * Hardware:
 *   - ESP32 Dev Board
 *   - DHT22         → GPIO 4  (air temperature + humidity)
 *   - Soil Moisture → GPIO 34 (analog, ADC1_CH6 — 0-4095)
 *   - NPK Sensor    → RS485 via MAX485 module
 *       DE/RE pin   → GPIO 5
 *       RX (RO)     → GPIO 16  (Serial2 RX)
 *       TX (DI)     → GPIO 17  (Serial2 TX)
 *
 * Flow:
 *   1. Read DHT22 temperature + humidity
 *   2. Read soil moisture (ADC → %)
 *   3. Read NPK sensor via Modbus RTU over RS485
 *   4. Build JSON payload
 *   5. POST to Raspberry Pi HTTP endpoint over Wi-Fi
 *   6. Sleep for SEND_INTERVAL_MS, repeat
 *
 * Dependencies (install via Arduino Library Manager):
 *   - DHT sensor library by Adafruit  (+ Adafruit Unified Sensor)
 *   - ArduinoJson  by Benoit Blanchon
 *
 * Board: ESP32 Dev Module (install via Boards Manager:
 *   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "DHT.h"

// ─── Configuration ────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Raspberry Pi local IP — change to match your network
const char* PI_HOST        = "http://192.168.1.100:5000";
const char* INGEST_PATH    = "/api/sensor/ingest";

// Shared secret — must match DEVICE_SECRET in Raspberry Pi / Node.js .env
const char* DEVICE_SECRET  = "iot-device-secret-change-in-prod";
const char* DEVICE_ID      = "esp32-node-1";

// Send interval (milliseconds) — 30 seconds
const unsigned long SEND_INTERVAL_MS = 30000UL;

// ─── Pin definitions ──────────────────────────────────────────────────────────
#define DHT_PIN          4
#define DHT_TYPE         DHT22
#define SOIL_MOISTURE_PIN 34   // ADC1_CH6 — must be an ADC1 pin

// RS485 MAX485 DE/RE control pin (HIGH = transmit, LOW = receive)
#define RS485_DE_RE_PIN  5
#define RS485_SERIAL     Serial2
#define RS485_RX         16
#define RS485_TX         17
#define RS485_BAUD       9600

// Soil moisture calibration — adjust these to match your sensor in air vs water
const int SOIL_DRY_ADC  = 3500;   // ADC value in completely dry soil
const int SOIL_WET_ADC  = 1200;   // ADC value in saturated soil

// ─── Objects ──────────────────────────────────────────────────────────────────
DHT dht(DHT_PIN, DHT_TYPE);

// ─── NPK Modbus RTU command ───────────────────────────────────────────────────
// Standard NPK sensor Modbus read-all command (device address 0x01, function 0x03,
// start register 0x0000, read 3 registers):
const byte NPK_CMD[]    = {0x01, 0x03, 0x00, 0x00, 0x00, 0x03, 0x05, 0xCB};
const int  NPK_CMD_LEN  = 8;
const int  NPK_RESP_LEN = 11; // 1+1+1+6+2 bytes

// ─── CRC16 Modbus ─────────────────────────────────────────────────────────────
uint16_t crc16(const byte* data, int len) {
  uint16_t crc = 0xFFFF;
  for (int i = 0; i < len; i++) {
    crc ^= data[i];
    for (int b = 0; b < 8; b++) {
      if (crc & 0x0001) crc = (crc >> 1) ^ 0xA001;
      else               crc >>= 1;
    }
  }
  return crc;
}

// ─── Read DHT22 ───────────────────────────────────────────────────────────────
struct DhtReading { float temperature; float humidity; bool valid; };

DhtReading readDht() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println("[DHT22] Read failed");
    return {0, 0, false};
  }
  return {t, h, true};
}

// ─── Read soil moisture ───────────────────────────────────────────────────────
float readSoilMoisture() {
  int raw = analogRead(SOIL_MOISTURE_PIN);
  // Map ADC value to percentage (higher ADC = drier soil)
  float pct = 100.0f - ((float)(raw - SOIL_WET_ADC) / (float)(SOIL_DRY_ADC - SOIL_WET_ADC) * 100.0f);
  pct = constrain(pct, 0.0f, 100.0f);
  return pct;
}

// ─── Read NPK via RS485/Modbus ────────────────────────────────────────────────
struct NpkReading { int nitrogen; int phosphorus; int potassium; bool valid; };

NpkReading readNpk() {
  // Switch MAX485 to transmit
  digitalWrite(RS485_DE_RE_PIN, HIGH);
  delayMicroseconds(100);

  RS485_SERIAL.write(NPK_CMD, NPK_CMD_LEN);
  RS485_SERIAL.flush();

  // Switch back to receive
  digitalWrite(RS485_DE_RE_PIN, LOW);

  // Wait for response (max 500 ms)
  unsigned long t0 = millis();
  while (RS485_SERIAL.available() < NPK_RESP_LEN && millis() - t0 < 500) {
    delay(5);
  }

  if (RS485_SERIAL.available() < NPK_RESP_LEN) {
    Serial.println("[NPK] Timeout — no response from sensor");
    return {0, 0, 0, false};
  }

  byte resp[NPK_RESP_LEN];
  RS485_SERIAL.readBytes(resp, NPK_RESP_LEN);

  // Validate CRC (last 2 bytes, little-endian)
  uint16_t received = (uint16_t)resp[NPK_RESP_LEN - 1] << 8 | resp[NPK_RESP_LEN - 2];
  uint16_t computed = crc16(resp, NPK_RESP_LEN - 2);
  if (received != computed) {
    Serial.println("[NPK] CRC mismatch");
    return {0, 0, 0, false};
  }

  // Parse registers: bytes 3-4 = N, 5-6 = P, 7-8 = K
  int n = (resp[3] << 8) | resp[4];
  int p = (resp[5] << 8) | resp[6];
  int k = (resp[7] << 8) | resp[8];

  return {n, p, k, true};
}

// ─── Connect Wi-Fi ────────────────────────────────────────────────────────────
void connectWifi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\n[WiFi] Connected — IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection failed — will retry");
  }
}

// ─── POST sensor data to Raspberry Pi ─────────────────────────────────────────
void postSensorData(float soilMoisture, float temperature, float humidity,
                    int nitrogen, int phosphorus, int potassium) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["deviceId"]    = DEVICE_ID;
  doc["soilMoisture"] = soilMoisture;
  doc["temperature"]  = temperature;
  doc["humidity"]     = humidity;
  doc["nitrogen"]     = nitrogen;
  doc["phosphorus"]   = phosphorus;
  doc["potassium"]    = potassium;

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  String url = String(PI_HOST) + INGEST_PATH;
  http.begin(url);
  http.addHeader("Content-Type",     "application/json");
  http.addHeader("X-Device-Secret",  DEVICE_SECRET);

  int code = http.POST(body);

  if (code > 0) {
    Serial.printf("[HTTP] POST %s → %d\n", url.c_str(), code);
    if (code == 200) {
      Serial.print("[HTTP] Response: ");
      Serial.println(http.getString().substring(0, 120));
    }
  } else {
    Serial.printf("[HTTP] POST failed: %s\n", http.errorToString(code).c_str());
  }

  http.end();
}

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== ESP32 Smart Irrigation Node ===");

  // DHT22
  dht.begin();

  // Soil moisture — configure ADC
  analogSetAttenuation(ADC_11db);  // Full 0–3.3 V range

  // RS485 MAX485
  pinMode(RS485_DE_RE_PIN, OUTPUT);
  digitalWrite(RS485_DE_RE_PIN, LOW);  // Default: receive mode
  RS485_SERIAL.begin(RS485_BAUD, SERIAL_8N1, RS485_RX, RS485_TX);

  // Wi-Fi
  connectWifi();
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
static unsigned long lastSend = 0;

void loop() {
  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();

    Serial.println("\n[Loop] Reading sensors...");

    // Read all sensors
    DhtReading  dhtData  = readDht();
    float       moisture = readSoilMoisture();
    NpkReading  npkData  = readNpk();

    // Print to serial monitor for debugging
    Serial.printf("  Soil Moisture : %.1f %%\n", moisture);
    if (dhtData.valid) {
      Serial.printf("  Temperature   : %.1f °C\n", dhtData.temperature);
      Serial.printf("  Humidity      : %.1f %%\n",  dhtData.humidity);
    } else {
      Serial.println("  DHT22         : READ FAILED");
    }
    if (npkData.valid) {
      Serial.printf("  Nitrogen      : %d mg/kg\n",  npkData.nitrogen);
      Serial.printf("  Phosphorus    : %d mg/kg\n",  npkData.phosphorus);
      Serial.printf("  Potassium     : %d mg/kg\n",  npkData.potassium);
    } else {
      Serial.println("  NPK sensor    : READ FAILED — using 0");
    }

    // Use 0 as fallback when sensor read fails
    float temp = dhtData.valid ? dhtData.temperature : 0;
    float hum  = dhtData.valid ? dhtData.humidity    : 0;
    int   n    = npkData.valid ? npkData.nitrogen     : 0;
    int   p    = npkData.valid ? npkData.phosphorus   : 0;
    int   k    = npkData.valid ? npkData.potassium    : 0;

    postSensorData(moisture, temp, hum, n, p, k);
  }

  delay(100);  // Yield to watchdog
}
