import { useState, useEffect } from 'react';
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
}

export function usePatientVitals(userId?: string) {
  const [vitals, setVitals] = useState<VitalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const isDemo = localStorage.getItem('demo_mode') === 'patient' || userId.startsWith('demo-') || !rtdb.app.options.apiKey || rtdb.app.options.apiKey.includes('mock-api-key');

    const useOfflineDefaults = () => {
      setVitals({
        heartRate: 0,
        bpm: 0,
        spo2: 0,
        temperature: 0,
        humidity: 55,
        ecg: 512,
        current_condition: 'Waiting for Device...',
        alertLevel: 1,
        alertReason: 'Waiting for Device...'
      });
      setLoading(false);
    };

    if (isDemo) {
      // Offline local simulation loop
      const interval = setInterval(() => {
        const hr = Math.round(65 + Math.random() * 20); // 65-85 BPM
        const spo2 = Math.round(96 + Math.random() * 4); // 96-100%
        const temp = Number((36.4 + Math.random() * 1.2).toFixed(1)); // 36.4-37.6 °C
        const isCritical = hr > 140 || (hr > 0 && hr < 40) || (spo2 > 0 && spo2 < 90);
        const isWarning = !isCritical && (hr > 100 || hr < 55 || (spo2 > 0 && spo2 < 95));
        const status = isCritical ? 'Critical' : isWarning ? 'Warning' : 'Normal';
        const alertLevel = isCritical ? 3 : isWarning ? 2 : 1;
        const alertReasonText = isCritical ? 'Critical Vitals' : isWarning ? 'Abnormal Vitals' : 'Optimal';

        // Generate baseline ECG
        const ecgArr = Array(40).fill(0).map(() => Math.floor(400 + Math.random() * 100));

        setVitals({
          heartRate: hr,
          bpm: hr,
          spo2: spo2,
          temperature: temp,
          humidity: 55,
          ecg: ecgArr,
          current_condition: status,
          alertLevel: alertLevel,
          alertReason: alertReasonText
        });
        setLoading(false);
      }, 1500);

      return () => clearInterval(interval);
    }

    const processVitalsData = (data: any) => {
      if (!data) {
        useOfflineDefaults();
        return;
      }

      const live = data.liveReading || data.livereading || data;
      const validated = validateSensorPacket(live);

      if (!validated.isValid) {
        setVitals(prev => prev ? { ...prev, current_condition: 'Signal Invalid', alertReason: validated.error || 'Signal Invalid' } : null);
        return;
      }

      let status: 'Normal' | 'Warning' | 'Critical' = 'Normal';
      let alertLevel = 1;

      if (validated.o2 > 0 && (validated.o2 < 90 || validated.heartRate > 130 || (validated.heartRate > 0 && validated.heartRate < 45))) {
        status = 'Critical';
        alertLevel = 3;
      } else if (validated.temp > 38 || (validated.o2 > 0 && validated.o2 < 95)) {
        status = 'Warning';
        alertLevel = 2;
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
        alertReason: alertReasonText
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

    return () => {
      unsub();
    };
  }, [userId]);

  return { vitals, loading, error };
}
