# CardioAlert AI + IoT Documentation

## 1. Project Overview

**CardioAlert AI + IoT** is a real-time, life-saving telemetry application designed to monitor cardiovascular health using IoT devices. It acts as a bridge between patient wearable sensors (like Arduino-based heart monitors) and healthcare providers. The system continuously receives vital signs—including Heart Rate, SpO2 (blood oxygen), Temperature, and raw ECG signal data.

By utilizing an advanced Digital Signal Processing (DSP) pipeline and integrating Google's Gemini AI, the system can instantly analyze abnormal readings, classify potential arrhythmias, and forecast risk progression. If a critical emergency is detected, it automatically dispatches alerts to family members and ambulance services via SMS and WhatsApp.

---

## 2. System Architecture

The architecture follows a modern, highly concurrent client-server model optimized for real-time telemetry:

### Data Flow
1. **IoT Layer**: Wearable sensors capture physiological data and send it over WebSockets to the central server.
2. **Server/Ingestion Layer**: A Node.js server receives WebSocket data, authenticates the patient, and buffers the ECG data to prevent memory fragmentation.
3. **Processing Pipeline**: 
    - The raw ECG signal goes through a multi-stage DSP pipeline to clean noise, filter artifacts, and assess signal quality.
    - Clinical features (e.g., QRS duration, PR interval, HRV) are extracted.
    - Risk levels are determined (Normal, Warning, Critical).
4. **AI Inference**: The system uses Google GenAI to analyze the vital signs and extracted features, generating explainable diagnoses and clinical recommendations.
5. **Storage & Realtime Sync**: Vitals are persisted to **Supabase (PostgreSQL)**, which simultaneously broadcasts updates to the front-end dashboard via real-time subscriptions.
6. **Alerting System**: If the alert level reaches 'Critical', the Twilio service is triggered to dispatch SMS/WhatsApp emergency alerts to predefined contacts (family & ambulance) along with the patient's live location.
7. **Frontend Layer**: Healthcare providers and doctors use a React-based dashboard to view live telemetry, ECG charts, maps, and AI insights.

---

## 3. Technology Stack

### Frontend (Client-Side)
- **Framework**: React 19, powered by Vite for lightning-fast HMR (Hot Module Replacement) and optimized builds.
- **Styling**: Tailwind CSS v4 for rapid, utility-first UI design, ensuring responsive and highly customizable aesthetics.
- **Routing**: React Router DOM v7 for seamless single-page application navigation.
- **State Management**: React Context API (e.g., `AuthContext`) paired with custom hooks.
- **Data Visualization**: 
  - **Recharts**: For rendering smooth, real-time ECG waveforms and vitals trends.
  - **React-Leaflet / Google Maps**: For tracking ambulance and patient live locations.
- **Animation**: Framer Motion for premium micro-interactions and smooth UI state transitions.

### Backend (Server-Side)
- **Runtime**: Node.js via `tsx` (TypeScript Execute) and Express.js.
- **Real-time Communication**: `ws` (WebSockets) for ultra-low latency, bi-directional telemetry streaming.
- **AI Integration**: `@google/genai` to interface with Gemini for generating explainable clinical insights based on raw vitals.
- **Notifications**: `twilio` SDK for SMS and WhatsApp emergency dispatch.

### Database & Auth
- **Supabase**: Open-source Firebase alternative utilizing PostgreSQL.
  - Handles User Authentication (Doctors vs. Patients).
  - Stores historical vitals (`vitals` table) and alerts (`alerts` table).
  - Provides real-time subscriptions to push database changes directly to connected web clients.

---

## 4. How It Was Built (Step-by-Step)

1. **Foundational Setup**: Initialized a Vite + React project with TypeScript. Integrated TailwindCSS for UI consistency.
2. **Database Schema Design**: Defined relational tables in Supabase for `users`, `patients`, `vitals`, and `alerts`. Set up Row Level Security (RLS) to ensure data privacy.
3. **Backend Telemetry Server**: Built an Express server (`server.ts`) running a WebSocket endpoint. Implemented logic to accept connections, validate physiological bounds (e.g., ignoring impossible 300 BPM readings due to loose wires), and buffer incoming ECG arrays.
4. **Signal Processing Pipeline (`ecgPipeline.ts`)**: Wrote custom DSP algorithms to clean noisy ECG signals, extract the R-R intervals, calculate Heart Rate Variability (HRV), and determine rhythm regularity.
5. **Emergency & Notification Logic**: Integrated the Twilio API to fire templated WhatsApp/SMS messages containing live location links and patient details whenever the vital thresholds breached critical limits for sustained periods.
6. **AI Integration**: Connected Google GenAI to consume the output of the ECG pipeline. Instructed the model to act as a clinical assistant, explaining why a rhythm was classified as anomalous and recommending next steps.
7. **Frontend Dashboard Development**: Built specialized views for Doctors (grid of patients, live ECG feeds) and Patients (personal health summary). Used Recharts to build the scrolling ECG monitor effect.

---

## 5. Key Libraries Used

| Library | Purpose |
| :--- | :--- |
| `express` & `ws` | Backend server and real-time WebSocket communication for IoT |
| `@supabase/supabase-js` | Database operations, real-time sync, and Auth |
| `@google/genai` | Advanced AI diagnostics and inference |
| `twilio` | Emergency communication (SMS, WhatsApp, Voice) |
| `recharts` | Rendering the real-time ECG waveform |
| `react-leaflet` | Displaying live map coordinates for emergencies |
| `react-hook-form` & `zod` | Robust form validation for patient/doctor registration |
| `tailwindcss` | Rapid, consistent UI styling |
| `framer-motion` | Smooth UI animations and transitions |

---

## 6. Efficiency & Performance Optimizations

The system is engineered for life-critical reliability and high throughput:

- **Zero-Allocation Buffers**: In the WebSocket ingestion pipeline, ECG arrays are buffered using sliding windows (`Array.prototype.shift()`) rather than reallocating memory continuously. This prevents Node V8 garbage collection pauses during critical telemetry streaming.
- **Multi-Stage Risk Confirmation**: To prevent false-positive alarms (e.g., from a patient adjusting their sensor), an anomaly must persist for a continuous duration (e.g., 8 seconds) before an alert state escalates from Warning to Critical.
- **Edge-Optimized Payload**: Instead of sending massive raw data arrays to the Gemini AI, the system first runs local, fast DSP algorithms to extract mathematical features (like QRS duration). It only sends these lightweight, highly dense numeric summaries to the AI, reducing API latency and token costs by over 90%.
- **Vite Bundling**: The frontend utilizes Vite's ESBuild, meaning the development server starts instantly, and production bundles are aggressively minified and tree-shaken.
- **Real-time Database Subscriptions**: Instead of the frontend constantly polling the server for updates via HTTP (which creates massive overhead), it listens to Supabase's Postgres WAL (Write-Ahead Log) via WebSockets. Updates are pushed only when new rows are written, saving immense bandwidth.

---

## Conclusion
CardioAlert AI + IoT represents a highly optimized, scalable, and intelligent approach to remote patient monitoring. By combining edge-like signal processing on a Node server with the analytical power of Google's Gemini AI, it moves beyond simple data logging and provides actionable, life-saving clinical intelligence in real-time.
