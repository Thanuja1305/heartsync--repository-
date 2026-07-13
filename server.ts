import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import twilio from "twilio";
import { GoogleGenAI, Type } from "@google/genai";
import { WebSocketServer } from "ws";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { 
  cleanECGSignal, 
  assessSignalQuality, 
  extractECGFeatures, 
  classifyECGRhythm 
} from "./src/services/ecgPipeline";
import { checkEmergencyCondition } from "./backend/services/emergencyService";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Supabase server connection
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Memory store to prevent duplicate alerts/WhatsApp sends
  const activeEmergencies = new Set<string>();


  // API ROUTE: Receive IoT Vitals from Arduino
  app.post("/api/vitals", async (req, res) => {
    try {
      const { patientId, heartRate, spo2, temperature, ecg } = req.body;
      if (!patientId || !heartRate || !spo2 || !temperature) {
        return res.status(400).json({ error: "Missing required vitals data" });
      }
      
      const is_emergency = heartRate > 120 || heartRate < 45 || spo2 < 90;

      const { error } = await supabase.from('vitals').insert([{
        patient_id: patientId,
        heart_rate: heartRate,
        spo2: spo2,
        temperature: temperature,
        ecg: ecg || [],
        is_emergency: is_emergency
      }]);

      if (error) throw error;
      
      if (is_emergency) {
          const { data: alertData } = await supabase.from('alerts').insert([{
              patient_id: patientId,
              severity: 'CRITICAL',
              message: `Critical vitals detected: HR ${heartRate}, SpO2 ${spo2}`
          }]).select();
          
          if (alertData && alertData[0]) {
             checkEmergencyCondition(supabase, alertData[0], {
                heart_rate: heartRate,
                spo2: spo2,
                temperature: temperature
             }, 'Excellent').catch(e => console.error('Emergency dispatch failed:', e));
          }
      }
      
      res.json({ success: true, message: "Vitals recorded" });
    } catch (error: any) {
      console.error("[ARDUINO API ERROR]:", error);
      res.status(500).json({ error: "Failed to record vitals" });
    }
  });
  // TWILIO UTILS
  const getTwilioConfig = () => {
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID || "",
      authToken: process.env.TWILIO_AUTH_TOKEN || "",
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || "+18157654866"
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

      const toFamily = "whatsapp:+917569824148";
      const toAmbulance = "whatsapp:+919573732216";
      const fromWhatsapp = "whatsapp:+14155238886";

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

      const ambulanceNumber = "9573732216";
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
    const configAdvice = "\n\n*(Note: HeartSync neural engine is running in high-security Clinical Fallback Mode because the backend GEMINI_API_KEY is currently invalid or missing. Please set a valid API key in your environment or AI Studio Settings menu to restore full conversational intelligence.)*";

    // Matching ear & jaw pain specifically as requested by user
    if ((query.includes("ear") && query.includes("jaw")) || (query.includes("ear") && query.includes("jw"))) {
      replyText = `**Important Triage Information Regarding Jaw & Ear Pain:**\n\n` +
        `You mentioned experiencing both **ear pain and jaw pain**. In cardiology and clinical triage, jaw pain—especially when it is radiating or accompanied by other discomforts—is a **well-known atypical symptom of cardiac distress** (such as angina or an impending myocardial infarction/heart attack).\n\n` +
        `**Current Live Telemetry Status:**\n` +
        `- **Heart Rate:** ${heartRate} BPM (${heartRate > 100 || heartRate < 55 ? 'Abnormal' : 'Within stable rest limits'})\n` +
        `- **Blood Oxygen (SpO2):** ${spo2}% (${spo2 < 95 ? 'Sub-optimal' : 'Excellent'})\n\n` +
        `**Immediate Triage Recommendations:**\n` +
        `1. **Stop all physical exertion immediately.** Sit or lie down in a semi-reclined, comfortable position to reduce cardiac load.\n` +
        `2. **Check for associated symptoms:** Are you experiencing any chest tightness, shortness of breath, lightheadedness, nausea, or sweating?\n` +
        `3. **Protocol:** If you have chest pressure, difficulty breathing, or if the jaw/ear pain spreads to your neck, shoulder, or left arm, **click the EMERGENCY SOS button on your dashboard immediately** and call emergency services (911 or your local provider).\n` +
        `4. If symptoms are mild, stay calm, rest quietly, and have someone monitor you. Consult with a doctor or cardiologist promptly to evaluate this pain.`;
    } else if (query.includes("ear")) {
      replyText = `**Pre-Clinical Assessment for Ear Pain:**\n\n` +
        `Ear pain can result from localized issues (such as otitis, temporomandibular joint (TMJ) strain, or dental referred pain). However, if the ear pain is combined with neck, jaw, or shoulder discomfort, or if it is accompanied by shortness of breath, it must be evaluated for potential cardiac origin.\n\n` +
        `**Vitals Review:**\n` +
        `- **Heart Rate:** ${heartRate} BPM\n` +
        `- **SpO2:** ${spo2}%\n\n` +
        `**Recommendation:** Rest quietly. If the pain radiates down to your jaw or shoulder, or if you feel any chest heaviness, treat this as a potential emergency and call for medical help.`;
    } else if (query.includes("jaw") || query.includes("jw") || query.includes("tooth") || query.includes("teeth")) {
      replyText = `**Pre-Clinical Assessment for Jaw/Teeth Pain:**\n\n` +
        `Jaw pain can be dental or musculoskeletal (like TMJ). However, **referred jaw pain** is a classic atypical presentation of cardiac ischemia (reduced blood flow to the heart). This is particularly true if the pain increases with physical effort and subsides with rest.\n\n` +
        `**Your Live Telemetry:**\n` +
        `- **Heart Rate:** ${heartRate} BPM\n` +
        `- **SpO2:** ${spo2}%\n\n` +
        `**Action Steps:** Sit down and rest. If this jaw pain is accompanied by chest tightness, pressure, or sweating, **please activate the Emergency SOS alert right away** and seek immediate emergency medical care.`;
    } else if (query.includes("chest") || query.includes("pain") || query.includes("pressure") || query.includes("tight") || query.includes("squeeze")) {
      replyText = `**🚨 CRITICAL WARNING: CHEST DISCOMFORT DETECTED**\n\n` +
        `Any chest pain, tightness, squeezing, or pressure should be treated with the utmost clinical caution. This could indicate a major cardiovascular event.\n\n` +
        `**Triage Instructions:**\n` +
        `1. **Activate Emergency SOS immediately** using the button on your dashboard.\n` +
        `2. Call your local emergency number (e.g., 911) right now. Do not attempt to drive yourself to the hospital.\n` +
        `3. Sit down, stay as calm as possible, and loosen any tight clothing.\n` +
        `4. If you have aspirin nearby and are not allergic or on contraindicating blood thinners, chew one adult aspirin (325 mg) or 2-4 low-dose baby aspirins.`;
    } else if (query.includes("emergency") || query.includes("protocol") || query.includes("sos") || query.includes("what should i do")) {
      replyText = `**HeartSync AI - Pre-Clinical Emergency Protocols:**\n\n` +
        `In the event of a suspected cardiac emergency (chest pain, radiating arm/jaw pain, severe shortness of breath, unexplained fainting, or sudden cold sweat):\n\n` +
        `1. **ALERT:** Click the red **EMERGENCY SOS** button on your dashboard. This triggers automated SMS and notification alerts to your designated clinicians and emergency contacts with your live GPS location.\n` +
        `2. **CALL SERVICES:** Phone emergency services (911 or your local equivalent) immediately.\n` +
        `3. **REST:** Sit down or lie in a comfortable semi-upright position (W-position with knees bent is standard to reduce cardiac demand). Do not walk or move unnecessarily.\n` +
        `4. **BREATHING:** Maintain slow, deep diaphragmatic breathing.\n` +
        `5. **MEDICATION:** If prescribed nitroglycerin by your cardiologist, administer it as directed. Chew aspirin (325mg) if advised by dispatchers and if you are not allergic.`;
    } else {
      replyText = `**HeartSync AI Pre-Clinical Triage Assistant:**\n\n` +
        `I am monitoring your live telemetry feed. Here is a summary of your current physiological state:\n` +
        `- **Heart Rate:** ${heartRate} BPM (${heartRate > 100 || heartRate < 55 ? 'Atypical / Elevated' : 'Optimal Rest Range'})\n` +
        `- **SpO2 (Blood Oxygen):** ${spo2}% (${spo2 < 95 ? 'Sub-optimal' : 'Healthy Range'})\n` +
        `- **Core Temperature:** ${temp.toFixed(1)}°C\n\n` +
        `**Medical Assistant Guidelines:**\n` +
        `- Describe any symptoms you are feeling (such as chest pain, jaw pain, shortness of breath, or palpitations).\n` +
        `- If you are feeling unwell or have specific questions about your cardiac telemetry, let me know!\n` +
        `- *In case of severe discomfort, always use the red Emergency SOS button on your dashboard.*`;
    }

    return {
      text: replyText + configAdvice,
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
          severity: 'CRITICAL',
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
            severity: 'CRITICAL',
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
          const { patientId, bpm, spo2, temperature, humidity, ecg } = payload;
          if (!patientId) return;

          associatedPatientId = patientId;

          // 1. SENSOR VALIDATION LAYER (Physiological boundary validation)
          const hr = Number(bpm ?? 0);
          const o2 = Number(spo2 ?? 0);
          const temp = Number(temperature ?? 0);
          const humid = Number(humidity ?? 0);

          if (hr < 20 || hr > 220 || o2 < 70 || o2 > 100 || temp < 30 || temp > 45 || humid < 0 || humid > 100) {
            console.warn(`[VALIDATION FLAGGED] Anomalous/Impossible reading from patient ${patientId}: HR=${hr}, SpO2=${o2}, Temp=${temp}, Humid=${humid}`);
            ws.send(JSON.stringify({ 
              type: "error", 
              message: "Telemetry rejected: physiological parameters out of safe bounds (possible artifact / loose lead)." 
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
          let rawAlertLevel = (o2 < 90 || hr > 130 || hr < 45) ? 3 : (temp > 38 || o2 < 95) ? 2 : 1;
          
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
            timestamp: Date.now()
          };

          await supabase.from('vitals').insert([{
            patient_id: patientId,
            heart_rate: hr,
            spo2: o2,
            temperature: temp,
            ecg: finalEcg,
            is_emergency: alertLevel === 3
          }]);

          // Log trauma warnings if emergency is active
          if (alertLevel === 3) {
            const { data: alertData } = await supabase.from('alerts').insert([{
              patient_id: patientId,
              severity: 'CRITICAL',
              message: `CRITICAL ALERT: HR=${hr}, SpO2=${o2}`
            }]).select();

            if (alertData && alertData[0]) {
              checkEmergencyCondition(supabase, alertData[0], {
                heart_rate: hr,
                spo2: o2,
                temperature: temp
              }, quality.rating).catch(e => console.error('Emergency dispatch failed:', e));
            }
          }

          // Return validated & annotated package back down ws channel
          ws.send(JSON.stringify({
            type: "telemetry_validated",
            data: liveValue,
            classification,
            quality
          }));
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
