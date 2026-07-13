/**
 * HEART SYNC - REAL-TIME ALERT & ESCALATION ENGINE HOOK
 * 
 * Sets up listeners for patient status shifts and triggers dual-state auditory indicators,
 * state bindings, and visual card mappings.
 */

import { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, get } from 'firebase/database';
import { rtdb } from '../lib/firebase';
import { 
  evaluateAlertSeverity, 
  VitalsPayload, 
  AlertSeverityResult, 
  handleMarkAsFalseAlert, 
  handleTriggerEmergencyAlert 
} from '../services/alertEscalationEngine';

export interface ClinicalReportData {
  ecgCondition: string;
  riskLevel: 'OPTIMAL' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  possibleIssue: string;
  recommendation: string;
}

export function useAlertEscalation(patientId: string | undefined, patientName: string = "Rahul Sharma") {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // States binding directly to visual dashboards
  const [vitals, setVitals] = useState<VitalsPayload | null>(null);
  const [alertSeverity, setAlertSeverity] = useState<AlertSeverityResult>({
    level: 1,
    status: 'Stable',
    triggerPopup: false,
    playAudio: false,
    label: 'Optimal State'
  });
  const [isAcknowledged, setIsAcknowledged] = useState<boolean>(false);
  const [muteAudio, setMuteAudio] = useState<boolean>(false);

  // AI Diagnostic Analysis details
  const [clinicalReport, setClinicalReport] = useState<ClinicalReportData>({
    ecgCondition: 'Monitoring baseline...',
    riskLevel: 'OPTIMAL',
    possibleIssue: 'None detected',
    recommendation: 'Continue standard telemetry surveillance.'
  });

  // Web Audio Context Synthesizer references for 100% reliable assetless sirens/beeps
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundIntervalRef = useRef<any>(null);

  // --- Initialize Audio Context safely ---
  const initAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  /**
   * Sound generator based on clinical priority:
   * - Level 3 (Critical pulse): Intermittent clean medium-pitch sinus beep
   * - Level 4 (Emergency siren): Continuous alternating high/low dual-tone sweep (ambulance sound)
   */
  const playAlertSound = (level: number) => {
    if (muteAudio) {
      stopAlertSound();
      return;
    }

    try {
      initAudioContext();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      // Stop existing generators
      stopAlertSound();

      if (level === 3) {
        // Level 3 Warning pulse: Intermittent beeps
        soundIntervalRef.current = setInterval(() => {
          if (!ctx || ctx.state === 'suspended') return;
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // Pitch A5
          
          gainNode.gain.setValueAtTime(0, ctx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
        }, 800);
      } 
      else if (level === 4) {
        // Level 4 Siren sweep: Alternating Ambulance high-low frequency
        let waveState = false;
        soundIntervalRef.current = setInterval(() => {
          if (!ctx || ctx.state === 'suspended') return;
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = 'sawtooth'; // High penetration wave
          // Sweep frequencies: 660Hz (E5) <=> 990Hz (B5)
          const targetFreq = waveState ? 990 : 660;
          osc.frequency.setValueAtTime(targetFreq, ctx.currentTime);
          
          gainNode.gain.setValueAtTime(0, ctx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
          gainNode.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.4);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.48);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
          waveState = !waveState;
        }, 500);
      }
    } catch (err) {
      console.warn('Web Audio synthesis blocked by browser auto-play policies:', err);
    }
  };

  const stopAlertSound = () => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
  };

  // Switch sound playing based on state changes and mute parameter
  useEffect(() => {
    if (alertSeverity.playAudio && !isAcknowledged) {
      playAlertSound(alertSeverity.level);
    } else {
      stopAlertSound();
    }
    return () => stopAlertSound();
  }, [alertSeverity.level, alertSeverity.playAudio, isAcknowledged, muteAudio]);

  // Firebase Real-time listeners
  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Live Readings Vitals stream (/users/${patientId}/liveReading or /patients/${patientId}/vitals)
    const liveReadingRef = ref(rtdb, `/users/${patientId}/liveReading`);
    const triageRef = ref(rtdb, `/patients/${patientId}/alert_state`);

    // Listen to live Reading elements
    const unsubVitals = onValue(liveReadingRef, async (snapshot) => {
      const data = snapshot.val();
      if (snapshot.exists() && data) {
        const bpm = Number(data.heartRate !== undefined ? data.heartRate : (data.bpm !== undefined ? data.bpm : 72));
        const spo2 = Number(data.spo2 !== undefined ? data.spo2 : 98);
        const temperature = Number(data.temperature !== undefined ? data.temperature : 36.5);
        const ecgStatus = data.ecgStatus || (data.ecg === "Flatline" ? "Flatline" : bpm > 140 ? "Irregular" : "Normal");

        const liveVitals: VitalsPayload = { bpm, spo2, temperature, ecgStatus };
        setVitals(liveVitals);

        // Run Multi-Parameter Triage Logic
        const result = evaluateAlertSeverity(liveVitals);
        setAlertSeverity(result);

        // Fetch or listen to acknowledgment status
        const alertStateSnap = await get(triageRef);
        if (alertStateSnap.exists()) {
          const stateData = alertStateSnap.val();
          setIsAcknowledged(!!stateData?.is_acknowledged && stateData?.level === result.level);
        } else {
          setIsAcknowledged(false);
        }

        // --- Generate Clinical Report dynamically ---
        let report: ClinicalReportData = {
          ecgCondition: ecgStatus === 'Flatline' ? 'Asystole (Flatline)' : ecgStatus === 'Irregular' ? 'Arrhythmia Detected' : 'Sinus Rhythm Stable',
          riskLevel: result.level === 4 ? 'EMERGENCY' : result.level === 3 ? 'CRITICAL' : result.level === 2 ? 'WARNING' : 'OPTIMAL',
          possibleIssue: result.label,
          recommendation: 'Maintain continuous patient diagnostics.'
        };

        if (result.level === 4) {
          if (ecgStatus === 'Flatline') {
            report.recommendation = 'Initiate immediate CPR. Mobilize Crash Cart / Defibrillator instantly and execute Code Blue.';
          } else if (result.status === 'Heart Attack Risk') {
            report.recommendation = 'Administer antiplatelet agents. Link secondary cardiac catheterization lab and prepare immediate surgical routing.';
          } else if (result.status === 'Sepsis Risk') {
            report.recommendation = 'Secure broad-spectrum IV antimicrobials and begin aggressive crystal fluid resuscitation.';
          }
        } else if (result.level === 3) {
          report.recommendation = 'Apply oxygen supplement mask. Re-evaluate blood pressure parameters and check arterial blood gas levels.';
        } else if (result.level === 2) {
          report.recommendation = 'Re-measure vital trends within 15 minutes. Note temperature curve or cardiac baseline anomalies.';
        }

        setClinicalReport(report);

        // Sync Alert State safely up to RTDB `/patients/$patientId/alert_state`
        // only if it differs or is a warning/critical state
        if (result.level > 1 && (!alertStateSnap.exists() || alertStateSnap.val().level !== result.level)) {
          set(triageRef, {
            level: result.level,
            status: result.status,
            timestamp: Date.now(),
            is_acknowledged: false,
            label: result.label
          }).catch(err => console.error("Database sync blocker:", err));
        }

      }
      setLoading(false);
    }, (err) => {
      console.error("RTDB listen error in clinical hook:", err);
      setError(err);
      setLoading(false);
    });

    return () => {
      unsubVitals();
      stopAlertSound();
    };
  }, [patientId]);

  // Interactive UI action bindings
  const onMarkAsFalseAlert = async () => {
    if (!patientId) return;
    try {
      stopAlertSound();
      setIsAcknowledged(true);
      await handleMarkAsFalseAlert(patientId, patientName);
      setAlertSeverity(prev => ({
        ...prev,
        level: 1,
        status: 'Stable',
        triggerPopup: false,
        playAudio: false,
        label: 'Marked as False Alarm'
      }));
    } catch (err) {
      console.error("Override transactional dispatch failure:", err);
    }
  };

  const onTriggerEmergencyAlert = async () => {
    if (!patientId) return;
    try {
      setIsAcknowledged(true);
      stopAlertSound();
      const currentVitals = vitals || { bpm: 72, spo2: 98, temperature: 36.5, ecgStatus: 'Normal' };
      await handleTriggerEmergencyAlert(patientId, patientName, currentVitals);
    } catch (err) {
      console.error("Lethal response dispatch error:", err);
    }
  };

  return {
    loading,
    error,
    vitals,
    alertSeverity,
    clinicalReport,
    isAcknowledged,
    muteAudio,
    setMuteAudio: (muted: boolean) => {
      setMuteAudio(muted);
      if (muted) stopAlertSound();
    },
    onMarkAsFalseAlert,
    onTriggerEmergencyAlert
  };
}
