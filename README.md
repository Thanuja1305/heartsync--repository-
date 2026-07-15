<div align="center">

# ❤️‍🔥 HeartSync — AI-Powered IoT Cardiac Monitoring System

**Real-Time ECG · Remote Patient Monitoring · AI-Driven Clinical Insights · Emergency Response**

[![Built with React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Firebase](https://img.shields.io/badge/Realtime-Firebase_RTDB-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![ESP32](https://img.shields.io/badge/Hardware-ESP32-E7352C?style=for-the-badge&logo=espressif)](https://www.espressif.com)
[![Gemini AI](https://img.shields.io/badge/AI-Google_Gemini-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev)

</div>

---

## 📋 Problem Statement

**Cardiovascular diseases (CVDs)** are the **#1 cause of death globally**, claiming approximately **17.9 million lives each year** (WHO, 2023). Despite this, continuous cardiac monitoring remains:

- **Expensive** — Hospital-grade Holter monitors cost ₹15,000–₹50,000 per session
- **Inaccessible** — Rural and semi-urban areas lack specialized cardiac care facilities
- **Reactive, not Proactive** — Patients typically visit doctors only *after* experiencing symptoms, missing early warning signs
- **Disconnected** — Existing devices record data locally but don't alert doctors in real-time
- **Lacking Intelligence** — Traditional monitors display numbers without clinical interpretation

> **The Gap:** There is no affordable, real-time, AI-powered cardiac monitoring system that connects patients directly to their doctors with instant emergency response — *until HeartSync*.

---

## 💡 How HeartSync Solves This

HeartSync is an **end-to-end IoT + AI healthcare platform** that bridges the gap between patients and doctors through continuous, intelligent cardiac monitoring.

### The Architecture (Pin-to-Pin Flow)

```
┌──────────────────┐     WiFi/WebSocket      ┌──────────────────┐
│   ESP32 Device   │ ──────────────────────→  │   Node.js Server │
│  AD8232 (ECG)    │   250Hz ECG Stream       │   (server.ts)    │
│  MAX30102 (SpO2) │   BPM, SpO2, Temp        │                  │
│  DS18B20 (Temp)  │                          │  ┌────────────┐  │
└──────────────────┘                          │  │ Supabase   │  │
                                              │  │ (History)  │  │
                                              │  └────────────┘  │
                                              │  ┌────────────┐  │
                                              │  │ Firebase   │  │
                                              │  │ (Realtime) │  │
                                              │  └────────────┘  │
                                              └────────┬─────────┘
                                                       │
                              ┌─────────────────────────┼──────────────────────────┐
                              ▼                         ▼                          ▼
                    ┌──────────────────┐     ┌──────────────────┐      ┌──────────────────┐
                    │ Patient Dashboard│     │ Doctor Dashboard │      │   AI Engine      │
                    │ • Live ECG       │     │ • Multi-patient  │      │ • Gemini AI      │
                    │ • Vitals Cards   │     │ • Alert Triage   │      │ • Risk Scoring   │
                    │ • AI Summary     │     │ • Emergency Btn  │      │ • ECG Analysis   │
                    └──────────────────┘     └──────────────────┘      └──────────────────┘
```

### How It Works (Step by Step)

1. **Sense** — ESP32 microcontroller with AD8232 ECG sensor, MAX30102 pulse oximeter, and DS18B20 temperature sensor captures real-time biometric data at 250Hz
2. **Stream** — Data is transmitted via WiFi WebSocket to the Node.js backend server
3. **Process** — Server validates sensor packets, filters noise, calculates BPM/SpO2, and routes data:
   - **Raw ECG waveforms** → WebSocket → Frontend (for live charting)
   - **Calculated metrics** → Firebase RTDB (for dashboard UI updates)
   - **Historical records** → Supabase PostgreSQL (for trend analysis)
4. **Display** — React dashboards render real-time ECG waveforms, vital signs, and connection status
5. **Analyze** — Google Gemini AI provides clinical-grade analysis: rhythm classification, risk scoring, and natural language health summaries
6. **Alert** — Critical vitals (HR >140, SpO2 <90) trigger multi-channel alerts: in-app notifications, Twilio WhatsApp messages, and emergency escalation

---

## ✅ Key Advantages

| Feature | HeartSync | Traditional Devices |
|---|---|---|
| **Real-time Monitoring** | ✅ Live ECG + vitals streaming at 250Hz | ❌ Data recorded locally, reviewed later |
| **AI-Powered Analysis** | ✅ Gemini AI classifies rhythms, scores risk, provides natural language summaries | ❌ No intelligence — just raw numbers |
| **Doctor-Patient Link** | ✅ Doctors see all patients' vitals in real-time from any browser | ❌ Doctor sees data only during hospital visits |
| **Fail-Safe Design** | ✅ 3-second timeout detection — shows "DEVICE DISCONNECTED" instantly when hardware goes offline | ❌ No disconnect awareness — shows stale data |
| **Emergency Response** | ✅ Automatic WhatsApp alerts + ambulance tracking + nearby hospital finder | ❌ Patient must manually call for help |
| **Multi-Sensor Fusion** | ✅ ECG + SpO2 + Temperature + Motion combined for holistic assessment | ❌ Single-metric devices (ECG only or SpO2 only) |
| **Cost** | ✅ ~₹2,500 total hardware cost (ESP32 + sensors) | ❌ ₹15,000–₹1,50,000 for medical-grade monitors |
| **Accessibility** | ✅ Works from any browser — patient at home, doctor at hospital | ❌ Requires physical proximity to equipment |
| **Data History** | ✅ Full PostgreSQL history with trend analysis and AI insights | ❌ Limited or no historical data storage |
| **Open Platform** | ✅ Open-source, extensible, can integrate with any hospital system | ❌ Proprietary, locked ecosystems |

---

## 🏥 What Makes HeartSync Different From Devices on the Market

### vs. Apple Watch / Fitbit
- Apple Watch takes a **30-second ECG snapshot** on demand. HeartSync provides **continuous 250Hz ECG streaming** 24/7
- No AI clinical interpretation on wearables — HeartSync provides **Gemini-powered risk scoring and rhythm classification**
- Wearables don't connect to a doctor's dashboard — HeartSync gives doctors **real-time multi-patient monitoring**

### vs. Hospital Holter Monitors
- Holter monitors cost ₹15,000+ per session and require hospital visits — HeartSync costs **₹2,500 once** and works from home
- Holter data is reviewed *after* 24–48 hours — HeartSync processes data **in real-time** with instant alerts
- No AI analysis — doctors manually read Holter printouts

### vs. Other IoT Health Monitors
- Most IoT monitors **lack fail-safe disconnect detection** — they show stale cached data when the device goes offline (a critical safety issue HeartSync explicitly solves)
- No integrated **emergency response pipeline** (WhatsApp alerts → ambulance tracking → nearest hospital locator)
- No **AI clinical assistant** that explains findings in natural language

---

## 🚀 Features

- 📊 **Live ECG Waveform** — Medical-grade PQRST rendering with R-peak detection, rhythm classification, and signal quality scoring
- ❤️ **Real-Time Vitals** — Heart rate (BPM), SpO2, body temperature, updated every 1.5 seconds
- 🤖 **AI Clinical Assistant** — Google Gemini-powered chat, health risk assessment, and ECG analysis
- 👨‍⚕️ **Doctor Dashboard** — Multi-patient monitoring, alert triage, emergency dispatch
- 🚨 **Emergency Pipeline** — Automatic detection → WhatsApp notification → ambulance tracking → nearest hospital finder
- 🔒 **Fail-Safe Design** — 3-second device timeout detection, mandatory "DEVICE DISCONNECTED" overlay, vitals show "--" when offline
- 🏥 **Nearby Hospitals** — RapidAPI + OpenStreetMap integration to locate nearest cardiac care facilities
- 📱 **Responsive Design** — Works on desktop, tablet, and mobile browsers
- 🔐 **Role-Based Access** — Separate patient and doctor portals with Firebase Auth + Supabase RLS

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Hardware** | ESP32, AD8232 ECG Sensor, MAX30102 Pulse Oximeter, DS18B20 Temperature |
| **Frontend** | React 18, TypeScript, Vite, Framer Motion, Tailwind CSS |
| **Backend** | Node.js, Express, WebSocket (ws) |
| **Realtime DB** | Firebase Realtime Database |
| **SQL Database** | Supabase (PostgreSQL) |
| **AI Engine** | Google Gemini 2.0 Flash |
| **Auth** | Firebase Authentication + Supabase RLS |
| **Alerts** | Twilio WhatsApp API |
| **Maps** | OpenStreetMap Overpass API + RapidAPI |

---

## 📦 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase project with Realtime Database enabled
- Supabase project
- (Optional) ESP32 hardware for real data — the app works in demo mode without hardware

### Installation

```bash
# Clone the repository
git clone https://github.com/Thanuja1305/heartsync--repository-.git
cd heartsync--repository-

# Install dependencies
npm install

# Configure environment variables
# Copy .env.example to .env and fill in your keys:
# - VITE_FIREBASE_API_KEY
# - VITE_FIREBASE_AUTH_DOMAIN
# - VITE_FIREBASE_PROJECT_ID
# - VITE_FIREBASE_DATABASE_URL
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - GEMINI_API_KEY

# Start the development server
npm run dev

# Open http://localhost:3000
```

### Demo Mode
If Firebase credentials are not configured, the app automatically enters **Demo Mode** with simulated patient data. A visible **⚡ DEMO MODE** badge appears in the header to clearly indicate that displayed data is simulated, not from real hardware.

---

## 🔒 Safety & Fail-Safe Design

HeartSync implements strict fail-safe protocols for patient safety:

1. **3-Second Timeout** — If no data packet arrives from the ESP32 within 3 seconds, the UI immediately switches to `isConnected: false`
2. **Mandatory Disconnect Overlay** — ECG chart displays "⚠️ CRITICAL: DEVICE DISCONNECTED - NO SIGNAL" with a red pulsing banner
3. **Vitals Blanked** — BPM, SpO2, and Temperature show `--` instead of stale last-known values
4. **Demo Mode Badge** — When simulation is active, a prominent amber "⚡ DEMO MODE" badge ensures no confusion between real and simulated data
5. **Device Online Default: FALSE** — The system assumes the device is offline until proven otherwise by receiving a validated data packet (fail-safe default)

---

## 👥 Team Credits

<div align="center">

### **Team Go-Getters** 🚀

| Role | Name | Contributions |
|---|---|---|
| **Project Lead & Full-Stack Developer** | **Thanuja** | System architecture, ESP32 firmware, backend API, database design, AI integration, IoT pipeline, deployment |
| **UI/UX & Frontend Developer** | **Shivani** | Dashboard design, responsive layouts, component library, user experience, visual design system |
| **QA Tester & Marketing** | **Yashasree** | Testing strategy, quality assurance, bug tracking, marketing materials, user research |

</div>

---

## 📄 License

This project is built for educational and demonstration purposes as part of the HeartSync IoT Cardiac Monitoring initiative.

---

<div align="center">

**Built with ❤️ by Team Go-Getters**

*Making cardiac care accessible, intelligent, and life-saving.*

</div>
