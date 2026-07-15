import { ref, set, onValue, serverTimestamp as rtdbTimestamp } from "firebase/database";
import { doc, setDoc, serverTimestamp as firestoreTimestamp } from "firebase/firestore";
import { db, rtdb } from "../lib/firebase";
import { supabase } from "../lib/supabase";

// This service simulates the IoT hardware (Arduino + ESP8266) flow
// In a real scenario, the Arduino would be writing to these RTDB paths directly.

export interface HealthMetrics {
  heartRate: number;
  spo2: number;
  temperature: number;
  motionStatus: "Normal" | "Elevated" | "Fall Detected" | "Running";
  ecgSignal: number[];
  isEmergency: boolean;
  timestamp: any;
}

export const startIoTSimulation = (patientId: string) => {
  let interval: any;

  console.warn(
    '%c⚠️ [HeartSync DEMO MODE] IoT Simulation Active — This is NOT real hardware data!',
    'background: #991b1b; color: #fecaca; padding: 8px 16px; font-size: 14px; font-weight: bold; border-radius: 4px;'
  );
  console.warn(`[HeartSync DEMO] Simulating patient: ${patientId} | Interval: 1500ms`);

  // Initial ECG baseline
  let ecgBase = Array(40).fill(0).map(() => 40 + Math.random() * 20);

  let ambulanceLocation: [number, number] = [40.7108, -74.0030]; // Start from near base
  let patientLocation: [number, number] = [40.7128, -74.0060];

  const updateMetrics = () => {
    // 1. Simulate Sensor Values with clean whole numbers as requested
    const hr = Math.round(65 + Math.random() * 20); // 65-85 BPM
    const spo2 = Math.round(96 + Math.random() * 4); // 96-100%
    const temp = Number((36.4 + Math.random() * 1.2).toFixed(1)); // 36.4-37.6 °C
    
    // Shift ECG and add new spikes
    ecgBase.shift();
    const isSpike = Math.random() > 0.85;
    ecgBase.push(Math.floor(isSpike ? 800 + Math.random() * 200 : 400 + Math.random() * 100));

    const metrics = {
      userId: patientId,
      bpm: hr,
      spo2: spo2,
      temperature: temp,
      motion: "Normal",
      ecg: [...ecgBase],
      isEmergency: hr > 110 || hr < 45 || spo2 < 90,
      timestamp: rtdbTimestamp(),
      location: { 
        latitude: patientLocation[0] + (Math.random() - 0.5) * 0.0001, 
        longitude: patientLocation[1] + (Math.random() - 0.5) * 0.0001 
      }
    };

    // 2. Write to Firebase Realtime Database
    const metricsRef = ref(rtdb, `liveHealthMetrics/${patientId}`);
    set(metricsRef, metrics);

    // Also write to user liveReading and livereading nodes in RTDB to feed Patient & Doctor dashboards in live real-time lockstep
    const userLiveReadingRef = ref(rtdb, `/users/${patientId}/liveReading`);
    const userLivereadingRef = ref(rtdb, `/users/${patientId}/livereading`);
    const userLiveValue = {
      bpm: hr,
      heartRate: hr,
      spo2: spo2,
      temperature: temp,
      humidity: 50 + Math.floor(Math.random() * 10),
      ecg: [...ecgBase],
      status: hr > 110 || hr < 45 || spo2 < 90 ? "Critical" : "Normal",
      alertLevel: hr > 110 || hr < 45 || spo2 < 90 ? 3 : 1,
      alertReason: hr > 110 || hr < 45 || spo2 < 90 ? "Critical Vitals" : "Optimal",
      timestamp: Date.now()
    };
    set(userLiveReadingRef, userLiveValue).catch(err => console.error("Sim node error 1:", err));
    set(userLivereadingRef, userLiveValue).catch(err => console.error("Sim node error 2:", err));

    // 3. Simulate Ambulance Movement if dispatched
    const ambRef = ref(rtdb, `ambulanceTracking/${patientId}`);
    if (metrics.isEmergency) {
      // Move ambulance closer to patient location
      const step = 0.0005;
      if (Math.abs(ambulanceLocation[0] - patientLocation[0]) > step) {
          ambulanceLocation[0] += ambulanceLocation[0] < patientLocation[0] ? step : -step;
      }
      if (Math.abs(ambulanceLocation[1] - patientLocation[1]) > step) {
          ambulanceLocation[1] += ambulanceLocation[1] < patientLocation[1] ? step : -step;
      }
      set(ambRef, { lat: ambulanceLocation[0], lng: ambulanceLocation[1], updatedAt: Date.now() });
    }

    // Update the Patient's main record for queue sorting
    const patientRef = doc(db, 'patients', patientId);
    setDoc(patientRef, {
      currentHeartRate: hr,
      isEmergencyActive: metrics.isEmergency,
    }, { merge: true });

    // Handle Emergencies: Create Notifications & Emergency Alerts
    if (metrics.isEmergency) {
      // Notification for patient
      const notifRef = doc(db, 'notifications', `${patientId}_${Date.now()}`);
      setDoc(notifRef, {
        userId: patientId,
        type: 'EMERGENCY',
        title: 'Critical Health Alert',
        message: `Emergency detected: BPM ${hr.toFixed(0)}, SpO2 ${spo2.toFixed(1)}%`,
        severity: 'Critical',
        read: false,
        createdAt: firestoreTimestamp()
      });

      // Public emergency alert for doctor dashboard
      const alertRef = doc(db, 'emergencyAlerts', patientId);
      setDoc(alertRef, {
        patientId,
        emergency: true,
        severity: "CRITICAL",
        detectedAt: Date.now(),
        status: "PENDING_DOCTOR_VERIFICATION",
        patientName: "Patient " + patientId.substring(0, 5),
        vitalsAtTrigger: {
          heartRate: hr,
          spo2: spo2,
          temp: temp
        },
        verifiedBy: null,
        verifiedAt: null
      }, { merge: true });

      // Persist in Supabase SQL alerts table
      supabase.from('patients').select('id').eq('user_id', patientId).maybeSingle().then(({ data: pRec }) => {
        if (pRec) {
          supabase.from('alerts').insert({
            patient_id: pRec.id,
            alert_type: 'CRITICAL_VITALS',
            severity: 'emergency',
            message: `Emergency detected: BPM ${hr.toFixed(0)}, SpO2 ${spo2.toFixed(1)}%`,
            triggered_value: { heartRate: hr, spo2: spo2, temp: temp },
            status: 'active'
          }).then(({ error }) => {
            if (error) console.error("Supabase alert insertion error:", error);
          });
        }
      });
    }
  };

  // Start the loop
  interval = setInterval(updateMetrics, 1500); // 1.5s for better real-time feel without hitting quotas too hard

  return () => {
    if (interval) clearInterval(interval);
  };
};
