import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import twilio from "twilio";
import { GoogleGenAI, Type } from "@google/genai";
import { WebSocketServer } from "ws";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { initializeApp } from "firebase/app";
import { getDatabase, ref as rtdbRef, set as rtdbSet } from "firebase/database";
import { getFirestore, doc as fsDoc, setDoc as fsSetDoc } from "firebase/firestore";
import { 
  cleanECGSignal, 
  assessSignalQuality, 
  extractECGFeatures, 
  classifyECGRhythm 
} from "./src/services/ecgPipeline";
import { checkEmergencyCondition } from "./backend/services/emergencyService";
import { TelemetryIngestionService } from "./backend/services/telemetryIngestion";
import { EscalationEngine } from "./backend/services/escalationEngine";
import { EmergencyDispatchService } from "./backend/services/emergencyDispatch";

dotenv.config();

// Initialize Firebase SDK on the backend
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

let rtdb: any = null;
let firestore: any = null;
try {
  console.info("[Firebase Backend] Initializing Firebase client with project:", firebaseConfig.projectId);
  const firebaseApp = initializeApp(firebaseConfig);
  rtdb = getDatabase(firebaseApp);
  firestore = getFirestore(firebaseApp);
  console.info("[Firebase Backend] Initialization successful.");
} catch (err) {
  console.error("[Firebase Backend] Error initializing Firebase client:", err);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Supabase server connection (using Service Role Key if available to bypass RLS)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Memory store to prevent duplicate alerts/WhatsApp sends
  const activeEmergencies = new Set<string>();

  // HeartSync Engine Initialization
  const telemetryIngestion = new TelemetryIngestionService(supabase);
  const escalationEngine = new EscalationEngine(supabase);
  const emergencyDispatchService = new EmergencyDispatchService(supabase);

  // Start the Escalation Engine Loop
  escalationEngine.start();

  // API ROUTE: Telemetry Engine Ingestion (REST Alternative to WS)
  app.post("/api/v1/telemetry", async (req, res) => {
    const result = await telemetryIngestion.ingestPacket(req.body);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  });

  // API ROUTE: Emergency Dispatch
  app.post("/api/v1/emergency/dispatch", async (req, res) => {
    await emergencyDispatchService.dispatchEmergency(req, res);
  });


  // API ROUTE: Receive IoT Vitals from Arduino / ESP32 IoT Devices
  // Architecture: Firebase RTDB = real-time streaming (always succeeds).
  //               Supabase = historical persistence (requires a valid registered patient UUID).
  app.post("/api/vitals", async (req, res) => {
    try {
      const { patientId, heartRate, spo2, temperature, ecg } = req.body;
      if (!patientId || heartRate === undefined || spo2 === undefined || temperature === undefined) {
        return res.status(400).json({ error: "Missing required vitals data" });
      }

      const hr = Number(heartRate);
      const o2 = Number(spo2);
      const temp = Number(temperature);
      const is_emergency = hr > 120 || hr < 45 || o2 < 90;

      // --- PRIORITY 1: Firebase RTDB (Real-Time Streaming — always runs, non-blocking) ---
      const liveReadingPayload = {
        bpm: hr,
        heartRate: hr,
        spo2: o2,
        temperature: temp,
        humidity: 55,
        ecg: Array.isArray(ecg) ? ecg : [512],
        status: is_emergency ? "Critical" : "Normal",
        alertLevel: is_emergency ? 3 : 1,
        alertReason: is_emergency ? "Critical Vitals" : "Optimal",
        timestamp: Date.now(),
        fingerDetected: true,
        leadsOff: false
      };

      if (rtdb) {
        rtdbSet(rtdbRef(rtdb, `/users/${patientId}/liveReading`), liveReadingPayload).catch(e => console.error("[RTDB] liveReading error:", e));
        rtdbSet(rtdbRef(rtdb, `/users/${patientId}/livereading`), liveReadingPayload).catch(e => console.error("[RTDB] livereading error:", e));
        rtdbSet(rtdbRef(rtdb, `/liveHealthMetrics/${patientId}`), liveReadingPayload).catch(e => console.error("[RTDB] liveHealthMetrics error:", e));
      }

      if (firestore) {
        fsSetDoc(fsDoc(firestore, 'liveHealthMetrics', patientId), {
          heartRate: hr, o2, temp,
          status: is_emergency ? "Critical" : "Optimal",
          timestamp: new Date().toISOString(),
          isEmergency: is_emergency,
          fingerDetected: true,
          leadsOff: false
        }, { merge: true }).catch(e => console.error("[Firestore] liveHealthMetrics error:", e));
      }

      // --- PRIORITY 2: Supabase PostgreSQL (Historical Persistence — only if patientId is a valid registered UUID) ---
      // IoT devices (ESP32) may send non-UUID IDs like "P001". We resolve the real patient UUID first.
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let resolvedPatientUUID: string | null = null;

      if (UUID_REGEX.test(patientId)) {
        // patientId looks like a UUID — verify it exists in patients table
        const { data: patientRow } = await supabase.from('patients').select('id').eq('id', patientId).maybeSingle();
        if (patientRow) resolvedPatientUUID = patientRow.id;
      } else {
        // Try to resolve by device_id in devices table (ESP32 may send its device label as patient_id)
        const { data: deviceRow } = await supabase.from('devices').select('patient_id').eq('device_id', patientId).maybeSingle();
        if (deviceRow?.patient_id) resolvedPatientUUID = deviceRow.patient_id;
      }

      if (resolvedPatientUUID) {
        // Insert into vitals (only schema-compliant columns)
        const { error: vitalsError } = await supabase.from('vitals').insert([{
          patient_id: resolvedPatientUUID,
          heart_rate: hr,
          spo2: o2,
          temperature: temp
        }]);
        if (vitalsError) console.error("[Supabase] vitals insert error:", vitalsError);

        // Insert critical alerts
        if (is_emergency) {
          const { data: alertData } = await supabase.from('alerts').insert([{
            patient_id: resolvedPatientUUID,
            alert_type: 'vitals_critical',
            severity: 'emergency',
            message: `Critical vitals detected: HR ${hr}, SpO2 ${o2}%`
          }]).select();

          if (firestore) {
            fsSetDoc(fsDoc(firestore, 'emergencyAlerts', patientId), {
              patientId, emergency: true, severity: "CRITICAL",
              detectedAt: Date.now(), status: "PENDING_DOCTOR_VERIFICATION",
              vitalsAtTrigger: { heartRate: hr, spo2: o2, temp },
              verifiedBy: null, verifiedAt: null
            }, { merge: true }).catch(e => console.error("[Firestore] emergencyAlerts error:", e));
          }

          if (alertData && alertData[0]) {
            checkEmergencyCondition(supabase, alertData[0], {
              heart_rate: hr, spo2: o2, temperature: temp
            }, 'Excellent').catch(e => console.error('[EmergencyService] dispatch failed:', e));
          }
        }
      } else {
        // Patient UUID not registered in DB — Firebase streaming still works.
        // This is normal for unregistered ESP32 devices or plain string IDs like "P001".
        console.warn(`[/api/vitals] Patient "${patientId}" not found in DB. Skipping Supabase write. Live data streaming to Firebase continues.`);
      }

      res.json({ success: true, message: "Vitals received and streamed" });
    } catch (error: any) {
      console.error("[ARDUINO API ERROR]:", error);
      res.status(500).json({ error: "Failed to process vitals" });
    }
  });
  // TWILIO UTILS
  const getTwilioConfig = () => {
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID || "",
      authToken: process.env.TWILIO_AUTH_TOKEN || "",
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || ""
    };
  };

  // API ROUTE: Send WhatsApp emergency message
  app.post("/api/send-emergency-whatsapp", async (req, res) => {
    try {
      const { patientId, patientName, heartRate, spo2, temp, force } = req.body;

      if (!patientId) {
        return res.status(400).json({ error: "patientId is required" });
      }

      // Check if message already sent for this patient alert session
      if (activeEmergencies.has(patientId) && !force) {
        return res.json({ 
          success: true, 
          message: "WhatsApp alert already sent for this emergency event (duplicate prevented).",
          alreadySent: true
        });
      }

      const config = getTwilioConfig();
      const twilioLib = twilio as any;
      const client = twilioLib.default ? twilioLib.default(config.accountSid, config.authToken) : twilio(config.accountSid, config.authToken);

      const nameVal = patientName || "John Doe";
      const hrVal = heartRate || 42;
      const spo2Val = spo2 || 82;
      const tempVal = temp || 39;

      const messageContent = `🚨 EMERGENCY ALERT 🚨\n\nPatient is in critical condition.\n\nPatient Name: ${nameVal}\nHeart Rate: ${hrVal} BPM\nSPO2: ${spo2Val}%\nTemperature: ${tempVal}°C\nStatus: HIGH RISK\n\nImmediate medical attention required.`;

      const toFamily = `whatsapp:${process.env.EMERGENCY_FAMILY_NUMBER || ""}`;
      const toAmbulance = `whatsapp:${process.env.EMERGENCY_AMBULANCE_NUMBER || ""}`;
      const fromWhatsapp = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || ""}`;

      console.log(`[TWILIO WHATSAPP] Sending alert from ${fromWhatsapp} to Family and Ambulance...`);

      const [msgFamily, msgAmbulance] = await Promise.all([
        client.messages.create({
          body: messageContent,
          from: fromWhatsapp,
          to: toFamily
        }),
        client.messages.create({
          body: messageContent,
          from: fromWhatsapp,
          to: toAmbulance
        })
      ]);

      console.log(`[TWILIO SUCCESS] WhatsApp Family SID: ${msgFamily.sid}, Ambulance SID: ${msgAmbulance.sid}`);

      // Track that alert is active
      activeEmergencies.add(patientId);

      return res.json({ 
        success: true, 
        sid: msgFamily.sid,
        message: "Emergency messages successfully sent to Family and Ambulance!" 
      });

    } catch (error: any) {
      console.error("[TWILIO FAILURE] WhatsApp sending failed:", error);
      return res.status(500).json({ 
        error: "Twilio WhatsApp send failed", 
        details: error?.message || String(error) 
      });
    }
  });

  // API ROUTE: Trigger Phone Call to Ambulance (Twilio Voice)
  app.post("/api/trigger-ambulance-call", async (req, res) => {
    try {
      const { patientId, patientName } = req.body;
      const config = getTwilioConfig();
      const twilioLib = twilio as any;
      const client = twilioLib.default ? twilioLib.default(config.accountSid, config.authToken) : twilio(config.accountSid, config.authToken);

      const ambulanceNumber = process.env.EMERGENCY_AMBULANCE_NUMBER || "";
      const formattedTo = ambulanceNumber.startsWith("+") ? ambulanceNumber : `+91${ambulanceNumber}`;

      console.log(`[TWILIO VOICE] Calling Ambulance at ${formattedTo}...`);

      const targetTwiml = `<Response>
        <Say voice="alice" loop="2">
          Emergency alert from Heart Sync Clinical Portal. Patient ${patientName || "identified"} is in critical status. Heart rate and parameters are severely out of limit. Immediate hospital ambulance dispatch requested. Please reply to acknowledge.
        </Say>
      </Response>`;

      const twilioCall = await client.calls.create({
        twiml: targetTwiml,
        to: formattedTo,
        from: config.phoneNumber
      });

      console.log(`[TWILIO VOICE SUCCESS] Call SID: ${twilioCall.sid}`);

      return res.json({ 
        success: true, 
        sid: twilioCall.sid,
        message: "Ambulance automated call initiated!" 
      });

    } catch (error: any) {
      console.error("[TWILIO FAILURE] Voice Call failed:", error);
      return res.status(500).json({ 
        error: "Voice Call Initiation failed", 
        details: error?.message || String(error) 
      });
    }
  });

  // API ROUTE: Reset/Clear active alert WhatsApp tracks
  app.post("/api/reset-emergency-state", (req, res) => {
    const { patientId } = req.body;
    if (patientId) {
      activeEmergencies.delete(patientId);
      console.log(`[STATE RESET] Active emergency state tag cleared for patient: ${patientId}`);
    } else {
      activeEmergencies.clear();
      console.log("[STATE RESET] All active emergency logs cleared.");
    }
    return res.json({ success: true });
  });

  // HELPER: Highly detailed Clinical Triage Fallback Generator in case of Gemini API issues
  function getClinicalFallbackResponse(message: string, context?: string, metrics?: any): { text: string; analysis: any } {
    const query = (message || '').toLowerCase();
    
    // Parse metrics from explicit parameters or context string
    let heartRate = 72;
    let spo2 = 98;
    let temp = 37.0;
    
    if (metrics) {
      heartRate = Number(metrics.bpm || metrics.heartRate || 72);
      spo2 = Number(metrics.spo2 || metrics.o2 || 98);
      temp = Number(metrics.temperature || metrics.temp || 37.0);
    } else if (context) {
      const hrMatch = context.match(/HR:\s*(\d+)/i) || context.match(/Heart\s*Rate:\s*(\d+)/i);
      const spo2Match = context.match(/SpO2:\s*(\d+)/i) || context.match(/Oxygen\s*\(SpO2\):\s*(\d+)/i);
      const tempMatch = context.match(/Temp(?:erature)?:\s*([\d.]+)/i);
      if (hrMatch) heartRate = parseInt(hrMatch[1], 10);
      if (spo2Match) spo2 = parseInt(spo2Match[1], 10);
      if (tempMatch) temp = parseFloat(tempMatch[1]);
    }

    // Determine physiological severity based on medical limits
    const hasCriticalVitals = heartRate > 120 || heartRate < 45 || spo2 < 90 || temp > 38.5;
    const hasWarningVitals = (heartRate > 100 && heartRate <= 120) || (heartRate >= 45 && heartRate < 55) || (spo2 >= 90 && spo2 < 95);

    let status = "NORMAL";
    let riskLevel = "Stable";
    let riskScore = 15;
    let suggestion = "Telemetry signals are optimal. Continue monitoring.";
    let reasoning = "All primary vital signals reside within standard homeostatic ranges. No action required.";
    let recommendation = "Maintain current rest cycle. No further intervention is indicated.";

    if (hasCriticalVitals) {
      status = "EMERGENCY";
      riskLevel = "Critical";
      riskScore = 85;
      suggestion = "CRITICAL LIMIT DETECTED. Activate Emergency Protocol.";
      reasoning = `Live telemetry indicates clinical threshold violation (HR: ${heartRate} BPM, SpO2: ${spo2}%). This requires immediate professional medical assessment.`;
      recommendation = "Click the EMERGENCY SOS button, sit or lie down, and call emergency services (911) immediately.";
    } else if (hasWarningVitals) {
      status = "RISK";
      riskLevel = "Elevated";
      riskScore = 45;
      suggestion = "Borderline physiological markers detected. Sit down and rest.";
      reasoning = `Slight deviation in vital parameters observed (HR: ${heartRate} BPM, SpO2: ${spo2}%). Patient should remain in a resting state while the system re-calibrates.`;
      recommendation = "Discontinue physical activity. Rest for 10 minutes and recheck vitals. If symptoms persist, consult a clinical specialist.";
    }

    let replyText = "";

    const isEmergency = 
      query.includes("chest") || query.includes("pain") || query.includes("pressure") || 
      query.includes("tight") || query.includes("squeeze") || query.includes("breath") ||
      query.includes("dizz") || query.includes("unconscious") || query.includes("stroke") ||
      query.includes("allerg") || query.includes("faint") || query.includes("jaw");

    if (isEmergency) {
      replyText = `⚠️ Chest discomfort or severe symptoms can have many causes, including some that require urgent attention.\n\n` +
        `If you are experiencing severe chest pain, pressure, difficulty breathing, sweating, fainting, or pain spreading to your arm/jaw:\n\n` +
        `• Call emergency services immediately.\n` +
        `• Sit down and avoid physical activity.\n` +
        `• Keep someone nearby if possible.\n\n` +
        `Can you tell me:\n` +
        `- Your age?\n` +
        `- When did the discomfort start?\n` +
        `- Is it sharp, burning, squeezing, or pressure-like?\n` +
        `- Are you having breathing difficulty?`;
    } else if (query.includes("emergency") || query.includes("protocol") || query.includes("sos") || query.includes("what should i do")) {
      replyText = `**Emergency Guidance:**\n\n` +
        `If you suspect a medical emergency:\n\n` +
        `1. **ALERT:** Click the red **EMERGENCY SOS** button on your dashboard.\n` +
        `2. **CALL SERVICES:** Phone emergency services (911) immediately.\n` +
        `3. **REST:** Sit down or lie in a comfortable semi-upright position. Do not walk or move unnecessarily.\n` +
        `4. Keep someone nearby if possible.`;
    } else {
      replyText = "I'm currently unable to provide a detailed AI response. If this is an emergency or you are experiencing severe symptoms, please contact emergency services immediately. You can also consult a healthcare professional.";
    }

    return {
      text: replyText,
      analysis: {
        status,
        suggestion,
        reasoning,
        recommendation,
        riskScore,
        riskLevel
      }
    };
  }

  // API ROUTE: Secure Server-Side Gemini Chat with Telemetry Injection
  app.post("/api/chat", async (req, res) => {
    const { message, history, context } = req.body;
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === "placeholder" || apiKey.includes("YOUR_")) {
        console.warn("[GEMINI CHAT]: Dynamic GEMINI_API_KEY is missing or unconfigured. Activating clinical fallback.");
        const fallback = getClinicalFallbackResponse(message, context);
        return res.json({ text: fallback.text });
      }

      // Initialize GoogleGenAI client with standard User-Agent header for telemetry
      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      // To prevent consecutive identical roles (such as duplicate "user" turns) which causes
      // validation errors in the Gemini API, we include the dynamic patient/vitals context
      // inside the systemInstruction and pass only strictly alternating messages in contents.
      const baseInstruction = "You are HeartSync AI, a highly specialized clinical cardiac assistant designed to provide medical decision support and pre-clinical triage.";
      const systemInstruction = context ? `${baseInstruction}\n\n[PATIENT VITALS & CONTEXT]:\n${context}` : baseInstruction;

      const rawContents = [
        ...(history || []).map((m: any) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.text || "" }]
        })),
        { role: "user", parts: [{ text: message }] }
      ];

      // Sanitize contents: filter empty parts and merge adjacent consecutive turns with the same role
      const contents: any[] = [];
      for (const item of rawContents) {
        if (!item.parts || item.parts.length === 0 || !item.parts[0].text) {
          continue;
        }

        if (contents.length > 0 && contents[contents.length - 1].role === item.role) {
          // Merge parts if consecutive turns have identical roles
          contents[contents.length - 1].parts[0].text += `\n${item.parts[0].text}`;
        } else {
          contents.push(item);
        }
      }

      // Ensure the content starts with "user" role and ends with "user" role
      if (contents.length > 0 && contents[0].role !== "user") {
        contents.shift();
      }
      if (contents.length > 0 && contents[contents.length - 1].role !== "user") {
        contents.pop();
      }

      // If contents is completely empty, fallback to the latest message as a single user turn
      if (contents.length === 0) {
        contents.push({ role: "user", parts: [{ text: message }] });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction,
        }
      });

      return res.json({ text: response.text });
    } catch (error: any) {
      console.error("[GEMINI CHAT ERROR - falling back gracefully]:", error);
      // Fallback in case of API Key failure or other runtime exception from the model
      const fallback = getClinicalFallbackResponse(message, context);
      return res.json({ text: fallback.text });
    }
  });

  // API ROUTE: Secure Server-Side health metrics analysis
  app.post("/api/analyze-metrics", async (req, res) => {
    const { userId, metrics } = req.body;
    try {
      if (!userId || !metrics) {
        return res.status(400).json({ error: "userId and metrics are required" });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === "placeholder" || apiKey.includes("YOUR_")) {
        throw new Error("GEMINI_API_KEY is not configured or is placeholder.");
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const prompt = `
        As a Cardiology AI Specialist, analyze these live patient metrics and provide a structured assessment.
        
        PATIENT METRICS:
        - Heart Rate: ${metrics.bpm || metrics.heartRate || 72} BPM
        - SpO2: ${metrics.spo2 || 98}%
        - Temperature: ${metrics.temperature || 98.6}°F
        - Motion: ${metrics.motion || metrics.motionStatus || "Resting"}
        - ECG Status: High-frequency waveform active
        
        RESPOND IN JSON FORMAT:
        {
          "status": "NORMAL" | "RISK" | "EMERGENCY",
          "suggestion": "Brief friendly suggestion for the patient dashboard",
          "reasoning": "Clinical reasoning for the AI Assistant tab (2-3 sentences)",
          "recommendation": "Next steps or medical advice",
          "riskScore": 0-100 (where 0 is healthy),
          "riskLevel": "Stable" | "Elevated" | "Critical"
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING },
              suggestion: { type: Type.STRING },
              reasoning: { type: Type.STRING },
              recommendation: { type: Type.STRING },
              riskScore: { type: Type.NUMBER },
              riskLevel: { type: Type.STRING }
            },
            required: ["status", "suggestion", "reasoning", "recommendation", "riskScore", "riskLevel"]
          }
        }
      });

      const text = response.text || "{}";
      const analysisResult = JSON.parse(text);

      // If emergency, create alert in Supabase
      if (analysisResult.status === 'EMERGENCY') {
        const { data: alertData } = await supabase.from('alerts').insert([{
          patient_id: userId,
          alert_type: 'ai_emergency',
          severity: 'emergency',
          message: analysisResult.reasoning
        }]).select();

        if (alertData && alertData[0]) {
          checkEmergencyCondition(supabase, alertData[0], {
            heart_rate: metrics.bpm || metrics.heartRate || 72,
            spo2: metrics.spo2 || 98,
            temperature: metrics.temperature || 98.6
          }, 'Excellent').catch(e => console.error('Emergency dispatch failed:', e));
        }
      }

      return res.json(analysisResult);
    } catch (error: any) {
      console.error("[GEMINI ANALYZE-METRICS ERROR - falling back gracefully]:", error);
      
      // Resilient Medical Fallback for Dashboard AI analysis when Gemini API is unconfigured
      const fallback = getClinicalFallbackResponse("", "", metrics);
      const analysisResult = fallback.analysis;

      try {
        // If emergency, ensure emergencyAlert is updated
        if (analysisResult.status === 'EMERGENCY') {
          const { data: alertData } = await supabase.from('alerts').insert([{
            patient_id: userId,
            alert_type: 'ai_emergency',
            severity: 'emergency',
            message: analysisResult.reasoning
          }]).select();

          if (alertData && alertData[0]) {
            checkEmergencyCondition(supabase, alertData[0], {
              heart_rate: metrics.bpm || metrics.heartRate || 72,
              spo2: metrics.spo2 || 98,
              temperature: metrics.temperature || 98.6
            }, 'Excellent').catch(e => console.error('Emergency dispatch failed:', e));
          }
        }
      } catch (dbError) {
        console.error("Failed to write offline fallback metrics to Firestore:", dbError);
      }

      return res.json(analysisResult);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (key) {
      if (key === "placeholder" || key.includes("YOUR_")) {
        console.warn("⚠️  [ENVIRONMENT WARNING] GEMINI_API_KEY is currently set to a placeholder value.");
      } else {
        console.info("🛡️  [ENVIRONMENT] GEMINI_API_KEY is successfully loaded from system environment variables.");
      }
    } else {
      console.warn("⚠️  [ENVIRONMENT WARNING] GEMINI_API_KEY is not defined in system environment variables.");
    }
  });

  // Setup Secure WebSocket Ingestion & Real-Time Broadcast Server
  const wss = new WebSocketServer({ server });

  const patientActiveWebSockets = new Map<string, any>();
  const ecgBuffers = new Map<string, number[]>();
  const alertStateTracker = new Map<string, { abnormalStartTime: number | null, lastReportedLevel: number }>();

  wss.on("connection", (ws) => {
    console.log("[WEBSOCKET] Secure telemetry channel established.");
    let associatedPatientId: string | null = null;

    ws.on("message", async (messageStr) => {
      try {
        const payload = JSON.parse(messageStr.toString());

        if (payload.type === "register") {
          associatedPatientId = payload.patientId;
          if (associatedPatientId) {
            patientActiveWebSockets.set(associatedPatientId, ws);
            console.log(`[WEBSOCKET] Secure Patient telemetry registered: ${associatedPatientId}`);
            ws.send(JSON.stringify({ type: "registered", patientId: associatedPatientId }));
          }
          return;
        }

        if (payload.type === "telemetry") {
          const { patientId, bpm, spo2, temperature, humidity, ecg, fingerDetected: rawFinger, leadsOff: rawLeads } = payload;
          if (!patientId) return;

          associatedPatientId = patientId;

          const hr = Number(bpm ?? 0);
          const o2 = Number(spo2 ?? 0);
          const temp = Number(temperature ?? 0);
          const humid = Number(humidity ?? 0);

          const fingerDetected = rawFinger === true || (hr > 0 && o2 > 0);
          const leadsOff = rawLeads === true;

          // 1. SENSOR VALIDATION LAYER (Physiological boundary validation)
          // If finger is detected, validate heart rate and spo2 ranges. If not, bypass to avoid rejecting 'no reading' packets.
          if (fingerDetected) {
            if (hr < 20 || hr > 220 || o2 < 70 || o2 > 100) {
              console.warn(`[VALIDATION FLAGGED] Anomalous/Impossible reading from patient ${patientId}: HR=${hr}, SpO2=${o2}`);
              ws.send(JSON.stringify({ 
                type: "error", 
                message: "Telemetry rejected: physiological parameters out of safe bounds." 
              }));
              return;
            }
          }

          // Validate temp and humidity as they do not depend on finger placement
          if (temp < 30 || temp > 45 || humid < 0 || humid > 100) {
            console.warn(`[VALIDATION FLAGGED] Anomalous/Impossible temp/humidity from patient ${patientId}: Temp=${temp}, Humid=${humid}`);
            ws.send(JSON.stringify({ 
              type: "error", 
              message: "Telemetry rejected: temp/humidity parameters out of safe bounds." 
            }));
            return;
          }

          // 2. ECG SIGNAL PROCESSING & CLINICAL DSP PIPELINE
          let ecgArray: number[] = Array.isArray(ecg) ? ecg : [];
          if (typeof ecg === "number") {
            let buf = ecgBuffers.get(patientId) || [];
            buf.push(ecg);
            if (buf.length > 250) buf.shift();
            ecgBuffers.set(patientId, buf);
            ecgArray = [...buf];
          } else if (ecgArray.length > 0) {
            ecgBuffers.set(patientId, ecgArray);
          }

          const cleanEcg = cleanECGSignal(ecgArray);
          const quality = assessSignalQuality(ecgArray);
          const features = extractECGFeatures(ecgArray, 250, hr);
          const classification = classifyECGRhythm(features, o2);

          // Determine raw risk level based on thresholds (Stage 2: Risk Detection)
          // If finger is NOT detected, do NOT trigger any hypoxemia or bradycardia alerts.
          let rawAlertLevel = 1;
          if (fingerDetected) {
            rawAlertLevel = (o2 < 90 || hr > 130 || hr < 45) ? 3 : (temp > 38 || o2 < 95) ? 2 : 1;
          }
          
          // Stage 1: Signal quality check. If bad: Do nothing (force normal to prevent false alarms)
          if (quality.rating === 'Poor') {
             rawAlertLevel = 1;
          }
          
          // Stage 3: Confirmation (Condition Persistence)
          const now = Date.now();
          let tracker = alertStateTracker.get(patientId) || { abnormalStartTime: null, lastReportedLevel: 1 };
          
          let alertLevel = tracker.lastReportedLevel;
          
          if (rawAlertLevel > 1) {
             if (tracker.abnormalStartTime === null) {
                tracker.abnormalStartTime = now;
             } else if (now - tracker.abnormalStartTime > 8000) { // 8 seconds of continuous abnormal state required
                alertLevel = rawAlertLevel;
                tracker.lastReportedLevel = alertLevel;
             }
          } else {
             // Instantly recover if state returns to normal
             tracker.abnormalStartTime = null;
             alertLevel = 1;
             tracker.lastReportedLevel = 1;
          }
          
          alertStateTracker.set(patientId, tracker);

          const status = alertLevel === 3 ? "Critical" : alertLevel === 2 ? "Warning" : "Normal";
          const alertReason = alertLevel === 3 ? "Critical Vitals" : alertLevel === 2 ? "Abnormal Vitals" : "Optimal";

          // Scale ECG into display-ready 100-900 indices if needed
          const finalEcg = cleanEcg.length > 0 ? cleanEcg.slice(-40).map(v => Math.round((v + 1) * 400 + 100)) : [512];

          // 3. SECURE TELEMETRY PROPAGATION (Supabase sync)
          const liveValue = {
            bpm: hr,
            heartRate: hr,
            spo2: o2,
            temperature: temp,
            humidity: humid,
            ecg: finalEcg,
            status,
            alertLevel,
            alertReason,
            classification: classification.prediction,
            confidence: classification.confidenceScore,
            timestamp: Date.now(),
            fingerDetected,
            leadsOff
          };

          // 3. SUPABASE PERSISTENCE — Resolve patient UUID first (non-fatal if not registered)
          const WS_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let wsPatientUUID: string | null = null;

          if (WS_UUID_REGEX.test(patientId)) {
            const { data: pRow } = await supabase.from('patients').select('id').eq('id', patientId).maybeSingle();
            if (pRow) wsPatientUUID = pRow.id;
          } else {
            const { data: dRow } = await supabase.from('devices').select('patient_id').eq('device_id', patientId).maybeSingle();
            if (dRow?.patient_id) wsPatientUUID = dRow.patient_id;
          }

          if (wsPatientUUID) {
            const { error: vErr } = await supabase.from('vitals').insert([{
              patient_id: wsPatientUUID,
              heart_rate: hr,
              spo2: o2,
              temperature: temp
            }]);
            if (vErr) console.error("[WS][Supabase] vitals insert error:", vErr);
          } else {
            console.warn(`[WS] Patient "${patientId}" not in DB — skipping Supabase vitals write. Firebase streaming active.`);
          }

          // Write to Firebase Realtime Database

          if (rtdb) {
            const liveReadingPayload = {
              bpm: hr,
              heartRate: hr,
              spo2: o2,
              temperature: temp,
              humidity: humid,
              ecg: finalEcg,
              status,
              alertLevel,
              alertReason,
              classification: classification.prediction,
              confidence: classification.confidenceScore,
              timestamp: Date.now(),
              fingerDetected,
              leadsOff
            };
            rtdbSet(rtdbRef(rtdb, `/users/${patientId}/liveReading`), liveReadingPayload).catch(e => console.error("RTDB liveReading error:", e));
            rtdbSet(rtdbRef(rtdb, `/users/${patientId}/livereading`), liveReadingPayload).catch(e => console.error("RTDB livereading error:", e));
            rtdbSet(rtdbRef(rtdb, `/liveHealthMetrics/${patientId}`), liveReadingPayload).catch(e => console.error("RTDB liveHealthMetrics error:", e));
          }

          // Write to Firebase Firestore
          if (firestore) {
            const firestoreVitals = {
              heartRate: hr,
              o2: o2,
              temp: temp,
              status: status === "Critical" ? "Critical" : status === "Warning" ? "Warning" : "Optimal",
              timestamp: new Date().toISOString(),
              isEmergency: alertLevel === 3,
              fingerDetected,
              leadsOff
            };
            fsSetDoc(fsDoc(firestore, 'liveHealthMetrics', patientId), firestoreVitals, { merge: true })
              .catch(e => console.error("Firestore liveHealthMetrics error:", e));
          }

          // Log trauma warnings if emergency is active
          if (alertLevel === 3) {
            // Firestore emergency alert (uses patientId as document key — always safe)
            if (firestore) {
              fsSetDoc(fsDoc(firestore, 'emergencyAlerts', patientId), {
                patientId, emergency: true, severity: "CRITICAL",
                detectedAt: Date.now(), status: "PENDING_DOCTOR_VERIFICATION",
                patientName: "Patient " + patientId.substring(0, 5),
                vitalsAtTrigger: { heartRate: hr, spo2: o2, temp },
                verifiedBy: null, verifiedAt: null
              }, { merge: true }).catch(e => console.error("Firestore emergencyAlerts error:", e));
            }

            // Supabase alert (only if patient UUID is resolved)
            if (wsPatientUUID) {
              const { data: alertData } = await supabase.from('alerts').insert([{
                patient_id: wsPatientUUID,
                alert_type: 'vitals_critical',
                severity: 'emergency',
                message: `CRITICAL ALERT: HR=${hr}, SpO2=${o2}`
              }]).select();

              if (alertData && alertData[0]) {
                checkEmergencyCondition(supabase, alertData[0], {
                  heart_rate: hr, spo2: o2, temperature: temp
                }, quality.rating).catch(e => console.error('Emergency dispatch failed:', e));
              }
            }
          }

          // Return validated & annotated package back down ws channel and broadcast to all dashboards
          const validatedMsg = JSON.stringify({
            type: "telemetry_validated",
            patientId,
            data: liveValue,
            classification,
            quality
          });

          // Send back to ESP32 source
          ws.send(validatedMsg);

          // Broadcast immediately to all connected clients (like frontend dashboards)
          wss.clients.forEach((client) => {
            if (client.readyState === 1) { // WebSocket.OPEN
              client.send(validatedMsg);
            }
          });
        }
      } catch (err) {
        console.error("[WEBSOCKET DISPATCH ERROR]:", err);
      }
    });

    ws.on("close", () => {
      console.log("[WEBSOCKET] Secure telemetry channel closed.");
      if (associatedPatientId) {
        patientActiveWebSockets.delete(associatedPatientId);
        ecgBuffers.delete(associatedPatientId);
        alertStateTracker.delete(associatedPatientId);
        
        // Zero-Fake-Data offline cleanup
        console.log("Patient WS disconnected, resources cleaned up:", associatedPatientId);
      }
    });
  });
}

startServer();
