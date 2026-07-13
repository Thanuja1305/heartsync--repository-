export interface ValidatedPacket {
  heartRate: number;
  o2: number;
  temp: number;
  humidity: number;
  ecg: number | number[];
  timestamp: number;
  isValid: boolean;
  error?: string;
}

const MAX_PACKET_AGE_MS = 10000; // Packets older than 10 seconds are stale

export function validateSensorPacket(live: any): ValidatedPacket {
  try {
    if (!live || typeof live !== 'object') {
      return { heartRate: 0, o2: 0, temp: 0, humidity: 55, ecg: 512, timestamp: Date.now(), isValid: false, error: "Empty packet" };
    }

    // 1. Timestamp Checker
    const packetTimestamp = live.timestamp ? Number(live.timestamp) : Date.now();
    const age = Date.now() - packetTimestamp;
    
    // If packet is from the future (clock skew) or too old
    if (age < -5000 || age > MAX_PACKET_AGE_MS) {
      return { heartRate: 0, o2: 0, temp: 0, humidity: 55, ecg: 512, timestamp: packetTimestamp, isValid: false, error: "Stale or invalid timestamp" };
    }

    // 2. Data Sanitizer
    const rawHr = Number(live.BPM ?? live.bpm ?? live.heartRate ?? live.HeartRate ?? 0);
    const rawO2 = Number(String(live.SpO2 ?? live.spo2 ?? live.SPO2 ?? live.o2 ?? 0).replace('%', ''));
    const rawTemp = Number(String(live.Temp ?? live.temperature ?? live.temp ?? 0).replace(/[CF\s]/gi, ''));
    const rawHum = Number(String(live.Humidity ?? live.humidity ?? 55).replace('%', ''));

    // 3. Validator (Plausible physiological ranges)
    const hrValue = isNaN(rawHr) ? 0 : Math.round(rawHr);
    const o2Value = isNaN(rawO2) ? 0 : Math.round(rawO2);
    const tempValue = isNaN(rawTemp) ? 0 : Number(rawTemp.toFixed(1));
    const humValue = isNaN(rawHum) ? 55 : Math.round(rawHum);

    // Sanity check extreme values (dead or hardware error)
    if (hrValue < 0 || hrValue > 300) throw new Error("HR out of bounds");
    if (o2Value < 0 || o2Value > 100) throw new Error("SpO2 out of bounds");
    if (tempValue < 0 || tempValue > 50) throw new Error("Temp out of bounds");

    let ecgValue: any = 512;
    const rawEcg = live.ECG ?? live.ecg;
    if (rawEcg !== undefined) {
      if (Array.isArray(rawEcg)) {
        ecgValue = rawEcg.map(Number).filter(v => !isNaN(v));
      } else if (typeof rawEcg === 'string') {
        // Only accept if it's a valid string-encoded number or comma separated list
        if (rawEcg.includes(',')) {
           ecgValue = rawEcg.split(',').map(Number).filter(v => !isNaN(v));
        } else {
           ecgValue = isNaN(Number(rawEcg)) ? 512 : Number(rawEcg);
        }
      } else {
        ecgValue = isNaN(Number(rawEcg)) ? 512 : Number(rawEcg);
      }
    }

    return {
      heartRate: hrValue,
      o2: o2Value,
      temp: tempValue,
      humidity: humValue,
      ecg: ecgValue,
      timestamp: packetTimestamp,
      isValid: true
    };
  } catch (err: any) {
    return {
      heartRate: 0, o2: 0, temp: 0, humidity: 55, ecg: 512, timestamp: Date.now(), isValid: false, error: err.message
    };
  }
}
