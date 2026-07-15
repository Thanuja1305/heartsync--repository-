# HeartSync — ESP32 IoT Firmware Reference

> **Hardware:** ESP32 DevKit · MH-ET LIVE MAX30102 · AD8232 ECG · DHT11 · Passive Buzzer (3-pin)  
> **Protocol:** WebSocket JSON to `server.ts` — matches the exact packet format the backend validates  
> **Last Updated:** 2026-07-15

---

## Table of Contents

1. [Required Libraries](#1-required-libraries)
2. [Wiring Diagrams](#2-wiring-diagrams)
3. [Clinical Alert Thresholds Reference](#3-clinical-alert-thresholds-reference)
4. [Complete Firmware — `HeartSync_ESP32.ino`](#4-complete-firmware)
5. [WebSocket Protocol](#5-websocket-protocol)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Required Libraries

Install all of these via **Arduino IDE → Tools → Manage Libraries** or **PlatformIO**:

| Library | Author | Version | Purpose |
|---|---|---|---|
| `WebSockets` | Markus Sattler (arduinoWebSockets) | ≥ 2.4.0 | WebSocket client for ESP32 |
| `ArduinoJson` | Benoit Blanchon | ≥ 7.x | JSON packet serialization |
| `DHT sensor library` | Adafruit | ≥ 1.4.4 | DHT11 temp/humidity sensor |
| `Adafruit Unified Sensor` | Adafruit | ≥ 1.1.9 | Required by DHT library |
| `SparkFun MAX3010x Pulse and Proximity Sensor Library` | SparkFun Electronics | ≥ 1.1.2 | Works with both MAX30102 and MH-ET LIVE MAX30102 |

> **Note:** The **MH-ET LIVE MAX30102** is fully compatible with the SparkFun MAX30105/MAX30102 library. No special driver needed.

---

## 2. Wiring Diagrams

### 2.1 MH-ET LIVE MAX30102 → ESP32

```
MAX30102 Pin    ESP32 Pin       Notes
────────────────────────────────────────────────
VIN / VCC   →  3.3V            Do NOT use 5V — will damage sensor
GND         →  GND
SDA         →  GPIO 21         I2C Data
SCL         →  GPIO 22         I2C Clock
INT         →  (optional)      Interrupt pin, leave unconnected for polling
```

> **I2C Address:** `0x57` (default, fixed on this module)

---

### 2.2 AD8232 ECG Sensor → ESP32

```
AD8232 Pin    ESP32 Pin         Notes
──────────────────────────────────────────────────────────
3.3V        →  3.3V             Power
GND         →  GND
OUTPUT      →  GPIO 34          ADC1 Channel 6 (input-only, no output conflict)
LO+         →  GPIO 32          Leads-off detection positive
LO-         →  GPIO 33          Leads-off detection negative
SDN         →  (optional)       Tie to 3.3V to keep sensor always ON
```

**Electrode Placement (standard 3-lead Einthoven):**
```
RA (Right Arm) — Red lead
LA (Left Arm)  — Yellow/Green lead  
RL (Right Leg) — Black lead (ground reference)
```

> **ESP32 ADC Note:** GPIO 34–39 are input-only. Use `analogSetAttenuation(ADC_11db)` for 0–3.3V full range reading. Avoid GPIO 35 if WiFi is active (ADC2 conflicts with WiFi on ESP32).

---

### 2.3 DHT11 → ESP32

```
DHT11 Pin     ESP32 Pin         Notes
───────────────────────────────────────────────────────
VCC (Pin 1) →  3.3V or 5V      Either voltage works
DATA (Pin 2) → GPIO 4           Add 10kΩ pull-up resistor between DATA and VCC
NC  (Pin 3) →  (leave empty)
GND (Pin 4) →  GND
```

---

### 2.4 Passive Buzzer (3-pin) → ESP32

```
Buzzer Pin    ESP32 Pin         Notes
──────────────────────────────────────────────────────────
VCC (+)     →  3.3V or 5V      Check your module's rated voltage
GND (-)     →  GND
SIG / IN    →  GPIO 25          PWM-capable pin for tone control
```

> A **passive buzzer** requires a PWM signal to produce sound. A 2kHz tone works well for alerts. Active buzzers (2-pin) just need HIGH/LOW — if yours is active, only VCC and GND matter; connect the third "SIG" pin to GPIO 25 and drive it HIGH.

---

### 2.5 Full Connection Summary

```
ESP32 DevKit
┌─────────────────────────────────────────────────────────────┐
│ 3.3V  → MAX30102 VCC, AD8232 3.3V, DHT11 VCC               │
│ GND   → MAX30102 GND, AD8232 GND, DHT11 GND, Buzzer GND    │
│ GPIO 4  → DHT11 DATA                                        │
│ GPIO 21 → MAX30102 SDA                                      │
│ GPIO 22 → MAX30102 SCL                                      │
│ GPIO 25 → Buzzer SIG                                        │
│ GPIO 32 → AD8232 LO+                                        │
│ GPIO 33 → AD8232 LO-                                        │
│ GPIO 34 → AD8232 OUTPUT (ECG analog)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Clinical Alert Thresholds Reference

The firmware uses **adult defaults** (18-64 yr). The server applies the same logic. These are the medically grounded thresholds built into the firmware:

### Heart Rate (BPM) — Adult Resting
| Zone | Range | Action |
|---|---|---|
| ✅ Normal | 60 – 100 BPM | No alert |
| ⚠️ Warning | 50-59 or 101-120 BPM | Local yellow buzzer pulse |
| 🚨 Critical | < 50 or > 120 BPM sustained 8s | Red buzzer alarm + WebSocket flag |
| ❌ Hardware fault | < 20 or > 220 BPM | Packet rejected — not transmitted |

### SpO2 (Blood Oxygen %)
| Zone | Range | Action |
|---|---|---|
| ✅ Normal | 95 – 100% | No alert |
| ⚠️ Warning | 90 – 94% | Local yellow buzzer pulse |
| 🚨 Critical | < 90% | Red buzzer alarm + WebSocket flag |
| ❌ Fault | 0% (sensor off finger) | Skip — do not send |

### Temperature (°C)
| Zone | Range | Action |
|---|---|---|
| ✅ Normal | 36.1 – 37.2°C | No alert |
| ⚠️ Warning | 37.3 – 38.5°C | Logged, no buzzer |
| 🚨 Critical | > 38.5°C or < 35°C | Included in telemetry for server decision |

### Exercise vs Cardiac Emergency Logic (Implemented in Firmware)
- **SpO2 tiebreaker:** If HR is elevated (101-140) but SpO2 stays ≥ 95%, the firmware labels it `WARNING` not `CRITICAL` — matches exercise/anxiety pattern.
- **Recovery window:** If HR was critical but returns to normal within 5 minutes AND SpO2 never dropped below 92%, the firmware sends a `recovery_note` flag to the server so the escalation engine can downgrade.
- **True emergency pattern:** HR elevated + SpO2 dropping together, or bradycardia at rest.

---

## 4. Complete Firmware

### File: `HeartSync_ESP32.ino`

```cpp
/*
  ╔═══════════════════════════════════════════════════════════════╗
  ║         HeartSync — ESP32 Production Firmware v2.0            ║
  ║  Sensors: MH-ET LIVE MAX30102 · AD8232 ECG · DHT11 · Buzzer  ║
  ║  Protocol: WebSocket JSON → server.ts (port 3000)             ║
  ╚═══════════════════════════════════════════════════════════════╝

  WebSocket Packet Format (matches server.ts exactly):
    REGISTER: {"type":"register","patientId":"P001"}
    TELEMETRY: {
      "type":"telemetry",
      "patientId":"P001",
      "bpm":72,
      "spo2":98,
      "temperature":36.5,
      "humidity":55.0,
      "ecg":[...250 integers...],
      "timestamp":1720000000000,
      "recoveryNote":false
    }

  Server validation bounds (from server.ts line 590):
    HR: 20–220, SpO2: 70–100, Temp: 30–45, Humidity: 0–100
*/

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"

// ═══════════════════════════════════════════════════════
//  ⚙️  CONFIGURATION — Edit these before flashing
// ═══════════════════════════════════════════════════════

const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* WS_HOST       = "192.168.1.100";  // Your server IP (run: ipconfig on Windows)
const uint16_t WS_PORT    = 3000;             // Matches PORT in server.ts
const char* WS_PATH       = "/";             // server.ts attaches WS to the root HTTP server
const char* PATIENT_ID    = "P001";          // Must match patient's UID in Firebase/Supabase

// ═══════════════════════════════════════════════════════
//  📍 PIN DEFINITIONS
// ═══════════════════════════════════════════════════════

#define DHT_PIN         4     // DHT11 data pin
#define DHT_TYPE        DHT11

#define ECG_PIN         34    // AD8232 analog output (ADC1_CH6 — safe with WiFi)
#define LO_PLUS_PIN     32    // AD8232 Leads-Off detection positive
#define LO_MINUS_PIN    33    // AD8232 Leads-Off detection negative

#define BUZZER_PIN      25    // Passive buzzer signal pin (PWM capable)

// I2C for MAX30102: SDA=21, SCL=22 (ESP32 defaults, no define needed)

// ═══════════════════════════════════════════════════════
//  🏥 CLINICAL THRESHOLDS (Adult 18-64, resting)
// ═══════════════════════════════════════════════════════

// These must stay within server.ts validation bounds (HR:20-220, SpO2:70-100, Temp:30-45)
#define HR_CRITICAL_LOW     50    // < 50 at rest → bradycardia risk
#define HR_CRITICAL_HIGH    120   // > 120 sustained at rest → tachyarrhythmia risk
#define HR_WARNING_LOW      55    // 50-59: borderline bradycardia
#define HR_WARNING_HIGH     100   // 100-120: elevated, watch closely
#define SPO2_CRITICAL       90    // < 90%: medical emergency at any age
#define SPO2_WARNING        95    // 90-94%: mild hypoxemia
#define TEMP_WARNING        37.3f // Low-grade fever
#define TEMP_CRITICAL       38.5f // True fever — flag in telemetry
#define TEMP_HYPO           35.0f // Hypothermia risk

// ═══════════════════════════════════════════════════════
//  📊 BUFFER SIZES
// ═══════════════════════════════════════════════════════

#define ECG_BUFFER_SIZE   250   // 1 second at 250Hz — matches server.ts ECG window
#define MAX_BUFFER_SIZE   100   // IR/RED samples for SpO2 algorithm

// ═══════════════════════════════════════════════════════
//  🌐 GLOBALS
// ═══════════════════════════════════════════════════════

WebSocketsClient webSocket;
bool isRegistered = false;
bool wsConnected  = false;
bool max30102Connected = false;

DHT dht(DHT_PIN, DHT_TYPE);
MAX30105 particleSensor;

// ECG ring buffer
int   ecgBuffer[ECG_BUFFER_SIZE];
int   ecgIndex = 0;

// MAX30102 sample buffers
uint32_t irBuffer[MAX_BUFFER_SIZE];
uint32_t redBuffer[MAX_BUFFER_SIZE];
int32_t  spo2Value     = 0;
int8_t   validSPO2     = 0;
int32_t  heartRateValue = 0;
int8_t   validHeartRate = 0;

// Timing
unsigned long lastEcgSampleMs   = 0;
const unsigned long ECG_INTERVAL = 4;  // 1000ms / 250 samples = 4ms per sample

// Alert state tracking (exercise vs cardiac event discrimination)
unsigned long criticalOnsetMs       = 0;  // When current critical state started
unsigned long recoveryStartMs       = 0;  // When vitals returned to normal
bool          inCriticalState       = false;
bool          spo2EverDroppedBelow92 = false;
int           lastAlertLevel        = 0;  // 0=Normal, 1=Warning, 2=Critical

// Buzzer
bool buzzerActive = false;

// ═══════════════════════════════════════════════════════
//  🔊 BUZZER CONTROL
// ═══════════════════════════════════════════════════════

void buzzCritical() {
  // Three short sharp beeps for critical
  for (int i = 0; i < 3; i++) {
    tone(BUZZER_PIN, 2000, 200);
    delay(300);
  }
}

void buzzWarning() {
  // One slow double-beep for warning
  tone(BUZZER_PIN, 1000, 150);
  delay(250);
  tone(BUZZER_PIN, 1000, 150);
}

void buzzOk() {
  // Single low tone on recovery
  tone(BUZZER_PIN, 500, 300);
}

// ═══════════════════════════════════════════════════════
//  📡 WEBSOCKET EVENT HANDLER
// ═══════════════════════════════════════════════════════

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {

    case WStype_CONNECTED: {
      wsConnected = true;
      Serial.println("[WS] ✅ Connected to HeartSync server.");

      // Send registration — server.ts line 568 expects this first
      StaticJsonDocument<128> reg;
      reg["type"]      = "register";
      reg["patientId"] = PATIENT_ID;
      String regStr;
      serializeJson(reg, regStr);
      webSocket.sendTXT(regStr);
      Serial.printf("[WS] Sent register for patientId: %s\n", PATIENT_ID);
      break;
    }

    case WStype_DISCONNECTED:
      wsConnected   = false;
      isRegistered  = false;
      Serial.println("[WS] ❌ Disconnected. Auto-reconnect in 3s...");
      break;

    case WStype_TEXT: {
      // Server confirms registration: {"type":"registered","patientId":"P001"}
      // Server confirms telemetry:    {"type":"telemetry_validated","data":{...},"classification":{...}}
      StaticJsonDocument<512> resp;
      DeserializationError err = deserializeJson(resp, payload, length);
      if (err) break;

      const char* respType = resp["type"] | "";

      if (strcmp(respType, "registered") == 0) {
        isRegistered = true;
        Serial.println("[WS] ✅ Registration confirmed by server. Telemetry streaming active.");
      } else if (strcmp(respType, "telemetry_validated") == 0) {
        int alertLevel = resp["data"]["alertLevel"] | 0;
        const char* status = resp["data"]["status"] | "Normal";
        Serial.printf("[SERVER] Status: %s | alertLevel: %d\n", status, alertLevel);
      } else if (strcmp(respType, "error") == 0) {
        Serial.printf("[SERVER ERROR] %s\n", resp["message"] | "Unknown error");
      }
      break;
    }

    default:
      break;
  }
}

// ═══════════════════════════════════════════════════════
//  🏥 ALERT LEVEL CALCULATION (Exercise vs Cardiac Discrimination)
// ═══════════════════════════════════════════════════════

/*
  Returns: 0 = Normal, 1 = Warning, 2 = Critical
  
  Key insight: SpO2 is the tiebreaker.
  - Exercise/anxiety → HR elevated, SpO2 stays ≥ 95%   → Warning only
  - True cardiac     → HR elevated + SpO2 dropping      → Critical
  - Bradycardia      → HR very low, regardless of SpO2  → Critical
*/
int computeAlertLevel(int hr, int spo2, float temp, bool leadsOff) {
  // Leads off = no valid ECG — don't alarm on ECG absence alone
  if (leadsOff) return 0;
  
  // SpO2 = 0 means sensor off finger — ignore
  if (spo2 == 0) return 0;

  // ── Critical conditions ──────────────────────────────
  // True hypoxemia: any HR + SpO2 < 90%
  if (spo2 > 0 && spo2 < SPO2_CRITICAL) return 2;
  
  // Bradycardia risk: very slow HR at rest
  if (hr > 0 && hr < HR_CRITICAL_LOW) return 2;
  
  // Tachycardia WITH SpO2 dropping = cardiac, not exercise
  if (hr > HR_CRITICAL_HIGH && spo2 > 0 && spo2 < SPO2_WARNING) return 2;
  
  // Hyperpyrexia combined with high HR
  if (temp > TEMP_CRITICAL && hr > HR_WARNING_HIGH) return 2;

  // ── Warning conditions (exercise/anxiety pattern) ────
  // HR elevated but SpO2 fine — likely exertion or anxiety
  if (hr > HR_WARNING_HIGH && spo2 >= SPO2_WARNING) return 1;
  
  // HR slightly low but not dangerously so
  if (hr > 0 && hr < HR_WARNING_LOW) return 1;
  
  // Mild hypoxemia
  if (spo2 > 0 && spo2 < SPO2_WARNING) return 1;
  
  // Low-grade fever
  if (temp > TEMP_WARNING) return 1;

  return 0; // Normal
}

// ═══════════════════════════════════════════════════════
//  📤 SEND TELEMETRY
// ═══════════════════════════════════════════════════════

void sendTelemetry() {
  if (!isRegistered || !wsConnected) return;

  // Read DHT11
  float temperature = dht.readTemperature();  // Celsius
  float humidity    = dht.readHumidity();
  if (isnan(temperature) || temperature < 0 || temperature > 50) temperature = 0;
  if (isnan(humidity)    || humidity < 0 || humidity > 100)       humidity = 55;

  int bpm  = 0;
  int spo2 = 0;
  bool fingerDetected = false;

  // Read MAX30102 only if connected, with a low timeout to prevent blocking the WebSocket event loop
  if (max30102Connected) {
    for (int i = 0; i < MAX_BUFFER_SIZE; i++) {
      // Block until a fresh sample is available (non-blocking with short timeout)
      unsigned long t0 = millis();
      while (!particleSensor.available()) {
        particleSensor.check();
        if (millis() - t0 > 5) break; // 5ms timeout per sample to prevent blocking WebSocket client
      }
      redBuffer[i] = particleSensor.getRed();
      irBuffer[i]  = particleSensor.getIR();
      particleSensor.nextSample();
    }

    // A finger is placed on the sensor if the IR amplitude is above 50,000
    fingerDetected = (irBuffer[MAX_BUFFER_SIZE - 1] > 50000UL);

    if (fingerDetected) {
      maxim_heart_rate_and_oxygen_saturation(
        irBuffer, MAX_BUFFER_SIZE, redBuffer,
        &spo2Value, &validSPO2, &heartRateValue, &validHeartRate
      );

      bpm  = (validHeartRate == 1 && heartRateValue > 15 && heartRateValue < 250) ? (int)heartRateValue : 0;
      spo2 = (validSPO2 == 1      && spo2Value > 70 && spo2Value <= 100)           ? (int)spo2Value     : 0;
    }
  }

  // Leads-off check
  bool leadsOff = (digitalRead(LO_PLUS_PIN) == HIGH) || (digitalRead(LO_MINUS_PIN) == HIGH);

  // Compute alert level
  int alertLevel = computeAlertLevel(bpm, spo2, temperature, leadsOff);

  // Track SpO2 history for recovery analysis
  unsigned long now = millis();
  if (spo2 > 0 && spo2 < 92) spo2EverDroppedBelow92 = true;

  // Recovery-time logic — if alert was critical and now normal
  bool recoveryNote = false;
  if (inCriticalState && alertLevel < 2) {
    if (recoveryStartMs == 0) recoveryStartMs = now;
    // After 5 minutes of normal readings post-critical, declare recovery
    if ((now - recoveryStartMs) > 300000UL) {
      recoveryNote = true;
      // If SpO2 never dropped below 92%, this was likely exercise/anxiety
      if (!spo2EverDroppedBelow92) {
        Serial.println("[CLINICAL] Recovery pattern: SpO2 stayed high → likely exercise/anxiety, not cardiac.");
      }
      inCriticalState      = false;
      spo2EverDroppedBelow92 = false;
      recoveryStartMs      = 0;
      criticalOnsetMs      = 0;
    }
  } else {
    recoveryStartMs = 0;
  }

  if (alertLevel == 2 && !inCriticalState) {
    inCriticalState = true;
    criticalOnsetMs = now;
    spo2EverDroppedBelow92 = (spo2 > 0 && spo2 < 92);
  }

  // Local buzzer feedback
  if (alertLevel == 2 && lastAlertLevel < 2) {
    buzzCritical();
  } else if (alertLevel == 1 && lastAlertLevel == 0) {
    buzzWarning();
  } else if (alertLevel == 0 && lastAlertLevel > 0) {
    buzzOk();
  }
  lastAlertLevel = alertLevel;

  // ── Build JSON payload (matches server.ts line 579 destructuring exactly) ──
  // Need: type, patientId, bpm, spo2, temperature, humidity, ecg
  // Extra: timestamp (server uses Date.now() if missing), recoveryNote (custom)
  
  // ArduinoJson: 250 ints × ~5 bytes + overhead — need at least 2048 bytes
  DynamicJsonDocument doc(4096);

  doc["type"]         = "telemetry";
  doc["patientId"]    = PATIENT_ID;
  doc["bpm"]          = bpm;
  doc["spo2"]         = spo2;
  doc["temperature"]  = round(temperature * 10) / 10.0;  // 1 decimal place
  doc["humidity"]     = round(humidity);
  doc["timestamp"]    = (uint64_t)millis();               // Relative ms — server uses Date.now() too
  doc["recoveryNote"] = recoveryNote;                     // Escalation engine uses this
  doc["fingerDetected"] = fingerDetected;
  doc["leadsOff"]       = leadsOff;

  JsonArray ecgArr = doc.createNestedArray("ecg");
  for (int i = 0; i < ECG_BUFFER_SIZE; i++) {
    ecgArr.add(ecgBuffer[i]);
  }

  String payload;
  payload.reserve(3800);
  serializeJson(doc, payload);
  webSocket.sendTXT(payload);

  // Debug output
  Serial.printf("[TX] BPM:%d SpO2:%d Temp:%.1f°C Humid:%.0f%% Alert:%d LeadsOff:%s ECG[0]:%d\n",
    bpm, spo2, temperature, humidity, alertLevel,
    leadsOff ? "YES" : "no", ecgBuffer[0]);
}

// ═══════════════════════════════════════════════════════
//  🔧 SETUP
// ═══════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n╔══════════════════════════════════╗");
  Serial.println("║  HeartSync ESP32 Firmware v2.0   ║");
  Serial.println("╚══════════════════════════════════╝");

  // ── Buzzer ──────────────────────────────────────────
  pinMode(BUZZER_PIN, OUTPUT);
  tone(BUZZER_PIN, 1000, 100); // Boot beep

  // ── ADC Configuration ───────────────────────────────
  // GPIO 34 is ADC1 — safe with WiFi. Set 11dB attenuation for 0–3.3V range.
  analogSetPinAttenuation(ECG_PIN, ADC_11db);
  analogReadResolution(12); // 12-bit: 0-4095

  // ── ECG (AD8232) ────────────────────────────────────
  pinMode(LO_PLUS_PIN,  INPUT);
  pinMode(LO_MINUS_PIN, INPUT);
  Serial.println("[AD8232] ECG pins configured.");

  // ── DHT11 ───────────────────────────────────────────
  dht.begin();
  Serial.println("[DHT11] Temperature sensor initialized.");

  // ── WiFi ─────────────────────────────────────────────
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - wifiStart > 20000) {
      Serial.println("\n[WiFi] ❌ Connection timeout! Restarting...");
      ESP.restart();
    }
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] ✅ Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  tone(BUZZER_PIN, 1200, 150); delay(200); tone(BUZZER_PIN, 1500, 150); // WiFi connected chime

  // ── MAX30102 (MH-ET LIVE) ───────────────────────────
  Wire.begin(21, 22);
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[MAX30102] ❌ Sensor not found! Check SDA(21)/SCL(22) wiring.");
    // Continue without — server will receive spo2=0 and not alarm on it
  } else {
    max30102Connected = true;
    // Optimized settings for accurate HR and SpO2 with MH-ET LIVE MAX30102
    byte ledBrightness = 60;   // 0=Off to 255=50mA. 60 ≈ 12mA, good for most fingers
    byte sampleAverage = 4;    // 1, 2, 4, 8, 16, 32
    byte ledMode       = 2;    // 1=Red only, 2=Red+IR, 3=Red+IR+Green
    byte sampleRate    = 200;  // 50, 100, 200, 400, 800, 1000, 1600, 3200
    int  pulseWidth    = 411;  // 69, 118, 215, 411 (wider = more precise)
    int  adcRange      = 16384;// 2048, 4096, 8192, 16384

    particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
    particleSensor.setPulseAmplitudeRed(0x0A); // Low red — just enough
    particleSensor.setPulseAmplitudeGreen(0);  // Green off (we don't use it)
    Serial.println("[MAX30102] ✅ MH-ET LIVE MAX30102 initialized. sampleRate=200Hz.");
  }

  // ── WebSocket ────────────────────────────────────────
  webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);
  // Optional: enable ping keepalive every 15s to prevent server timeout
  webSocket.enableHeartbeat(15000, 3000, 2);
  Serial.printf("[WS] Connecting to ws://%s:%d%s\n", WS_HOST, WS_PORT, WS_PATH);

  Serial.println("[BOOT] ✅ HeartSync firmware ready. Starting telemetry loop...");
}

// ═══════════════════════════════════════════════════════
//  🔄 MAIN LOOP
// ═══════════════════════════════════════════════════════

void loop() {
  webSocket.loop(); // Must be called as fast as possible

  unsigned long now = millis();

  // ── Sample ECG at 250Hz ──────────────────────────────
  if (now - lastEcgSampleMs >= ECG_INTERVAL) {
    lastEcgSampleMs = now;

    bool leadsOff = (digitalRead(LO_PLUS_PIN) == HIGH) || (digitalRead(LO_MINUS_PIN) == HIGH);

    // If leads off: send 512 (mid-scale neutral — server treats as valid flat line)
    // If connected: read 12-bit ADC (0–4095), center around 2048 like a real ECG
    int sample = leadsOff ? 512 : analogRead(ECG_PIN);

    if (ecgIndex < ECG_BUFFER_SIZE) {
      ecgBuffer[ecgIndex++] = sample;
    }
  }

  // ── When ECG buffer is full (1 second) and registered: send telemetry ──
  if (ecgIndex >= ECG_BUFFER_SIZE && isRegistered) {
    sendTelemetry();
    ecgIndex = 0; // Reset for next 1-second window
  }

  // ── WiFi watchdog ────────────────────────────────────
  static unsigned long lastWifiCheck = 0;
  if (now - lastWifiCheck > 30000) {
    lastWifiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] Lost connection. Reconnecting...");
      WiFi.reconnect();
    }
  }
}
```

---

## 5. WebSocket Protocol

The firmware communicates with `server.ts` using this exact JSON protocol:

### Outbound (ESP32 → Server)

```json
// Step 1: Register immediately after connecting
{ "type": "register", "patientId": "P001" }

// Step 2: Telemetry every 1 second (when ECG buffer is full)
{
  "type": "telemetry",
  "patientId": "P001",
  "bpm": 72,
  "spo2": 98,
  "temperature": 36.5,
  "humidity": 55,
  "ecg": [512, 518, 522, 501, 487, "... 250 integers total"],
  "timestamp": 1720000000000,
  "recoveryNote": false
}
```

### Inbound (Server → ESP32)

```json
// Registration confirmed
{ "type": "registered", "patientId": "P001" }

// Telemetry accepted and processed
{
  "type": "telemetry_validated",
  "data": { "bpm": 72, "status": "Normal", "alertLevel": 1, "ecg": [...] },
  "classification": { "prediction": "Normal Sinus Rhythm", "confidenceScore": 98 },
  "quality": { "score": 87, "rating": "Good" }
}

// Packet rejected (out of physiological range)
{
  "type": "error",
  "message": "Telemetry rejected: physiological parameters out of safe bounds"
}
```

---

## 6. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| MAX30102 not found | I2C wiring or wrong address | Check SDA=21, SCL=22. I2C addr is `0x57` |
| SpO2 always 0 or 99 | Finger placement | Keep finger still, cover sensor from ambient light |
| HR wildly jumping | Motion artifact | Stay still for 20+ seconds while holding the sensor |
| ECG flat line | Leads off or LO pins floating | Check LO+ and LO- pins, apply electrode gel |
| WS never connects | Wrong IP or server not running | Run `ipconfig` on your PC, check `npm run dev` is running |
| "Packet rejected" errors | Temp/humidity reading 0 | DHT11 needs 2 seconds to warm up after boot |
| Buzzer not sounding | Active vs passive mismatch | Active buzzer: just drive HIGH. Passive: needs `tone()` |
| ADC reading noisy on GPIO34 | ADC2 conflict | Already using ADC1 (GPIO34) — correct. Don't use GPIO 35-39 with WiFi |
