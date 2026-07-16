import { useState, useEffect, useRef } from 'react';
import { rtdb } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';
import { validateSensorPacket } from '../lib/dataValidator';

export interface VitalsData {
  heartRate: number | string;
  bpm: number | string;
  spo2: number | string;
  temperature: number | string;
  humidity?: number;
  ecg?: number | number[];
  current_condition?: string;
  alertLevel?: number; // 1 = optimal, 2 = warning, 3 = critical
  alertReason?: string;
  fingerDetected?: boolean;
  leadsOff?: boolean;
}

export function usePatientVitals(userId?: string) {
  const [vitals, setVitals] = useState<VitalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isDeviceOnline, setIsDeviceOnline] = useState(false); // FAIL-SAFE: offline by default until real data arrives
  const [deviceStatus, setDeviceStatus] = useState<string>('offline');
  
  const lastSeenRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const useOfflineDefaults = () => {
      setVitals({
        heartRate: '--',
        bpm: '--',
        spo2: '--',
        temperature: '--',
        humidity: 0,
        ecg: 512,
        current_condition: 'Waiting for Device...',
        alertLevel: 1,
        alertReason: 'Waiting for Device...',
        fingerDetected: false,
        leadsOff: false
      });
      setIsDeviceOnline(false);
      setDeviceStatus('disconnected');
      setLoading(false);
    };

    // Set up an active timeout monitoring interval (runs every 1 second)
    const checkTimeoutInterval = setInterval(() => {
      const isOnline = Date.now() - lastSeenRef.current < 3000;
      setIsDeviceOnline(isOnline);
      if (!isOnline) {
        useOfflineDefaults();
      }
    }, 1000);

    const processVitalsData = (data: any) => {
      if (!data) {
        useOfflineDefaults();
        return;
      }

      const live = data.liveReading || data.livereading || data;
      
      if (live.deviceStatus === 'disconnected') {
        setIsDeviceOnline(false);
        setDeviceStatus('disconnected');
        useOfflineDefaults();
        return;
      }

      const validated = validateSensorPacket(live);

      if (!validated.isValid) {
        setVitals(prev => prev ? { ...prev, current_condition: 'Signal Invalid', alertReason: validated.error || 'Signal Invalid' } : null);
        return;
      }

      // Check if packet itself is stale (older than 3 seconds)
      const packetAge = Date.now() - (live.timestamp || Date.now());
      if (packetAge > 3000) {
        setIsDeviceOnline(false);
        useOfflineDefaults();
        return;
      }

      lastSeenRef.current = Date.now();
      setIsDeviceOnline(true);
      setDeviceStatus('connected');

      let status: 'Normal' | 'Warning' | 'Critical' = 'Normal';
      let alertLevel = 1;

      const fingerDetected = live.fingerDetected === true || (validated.heartRate > 0 && validated.o2 > 0);
      const leadsOff = live.leadsOff === true;

      if (fingerDetected) {
        if (validated.o2 > 0 && (validated.o2 < 90 || validated.heartRate > 130 || (validated.heartRate > 0 && validated.heartRate < 45))) {
          status = 'Critical';
          alertLevel = 3;
        } else if (validated.temp > 38 || (validated.o2 > 0 && validated.o2 < 95)) {
          status = 'Warning';
          alertLevel = 2;
        }
      }

      let alertReasonText = status === 'Critical' ? 'Critical Vitals' : status === 'Warning' ? 'Abnormal Vitals' : 'Optimal';

      setVitals({
        heartRate: validated.heartRate,
        bpm: validated.heartRate,
        spo2: validated.o2,
        temperature: validated.temp,
        humidity: validated.humidity,
        ecg: validated.ecg,
        current_condition: status,
        alertLevel: alertLevel,
        alertReason: alertReasonText,
        fingerDetected,
        leadsOff
      });
      setLoading(false);
    };

    const patientRef = ref(rtdb, `/users/${userId}`);
    const unsub = onValue(patientRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          processVitalsData(snapshot.val());
        } else {
          useOfflineDefaults();
        }
      } catch (err: any) {
        setError(err);
      }
    }, (err) => {
      setError(err);
      useOfflineDefaults();
    });

    const handleTelemetry = (e: Event) => {
      const { patientId, data } = (e as CustomEvent).detail;
      if (patientId === userId) {
        // Check if packet itself is stale (older than 3 seconds)
        const packetAge = Date.now() - (data.timestamp || Date.now());
        if (packetAge > 3000) {
          setIsDeviceOnline(false);
          useOfflineDefaults();
          return;
        }

        lastSeenRef.current = Date.now();
        setIsDeviceOnline(true);
        setVitals({
          heartRate: data.bpm,
          bpm: data.bpm,
          spo2: data.spo2,
          temperature: data.temperature,
          humidity: data.humidity,
          ecg: data.ecg,
          current_condition: data.status,
          alertLevel: data.alertLevel,
          alertReason: data.alertReason,
          fingerDetected: data.fingerDetected,
          leadsOff: data.leadsOff
        });
        setLoading(false);
      }
    };
    window.addEventListener('heartsync-telemetry', handleTelemetry);

    return () => {
      unsub();
      clearInterval(checkTimeoutInterval);
      window.removeEventListener('heartsync-telemetry', handleTelemetry);
    };
  }, [userId]);

  return { vitals, loading, error, isDeviceOnline: isDeviceOnline && deviceStatus !== 'disconnected', deviceStatus };
}

