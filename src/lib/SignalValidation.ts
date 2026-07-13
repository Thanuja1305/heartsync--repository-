export interface ValidationResult {
  isValid: boolean;
  bpmValid: boolean;
  spo2Valid: boolean;
  tempValid: boolean;
  invalidFields: string[];
}

/**
 * Validates physiological sensor values against medical boundaries.
 * Boundaries:
 * - Heart Rate (BPM): 20 to 220
 * - SpO2: 70% to 100%
 * - Core Temperature: 30°C to 45°C
 */
export function validatePhysiologicalSignals(data: {
  heartRate?: number | null;
  bpm?: number | null;
  spo2?: number | null;
  o2?: number | null;
  temperature?: number | null;
  temp?: number | null;
}): ValidationResult {
  const hr = data.heartRate !== undefined && data.heartRate !== null ? data.heartRate : (data.bpm !== undefined && data.bpm !== null ? data.bpm : null);
  const o2 = data.spo2 !== undefined && data.spo2 !== null ? data.spo2 : (data.o2 !== undefined && data.o2 !== null ? data.o2 : null);
  const temp = data.temperature !== undefined && data.temperature !== null ? data.temperature : (data.temp !== undefined && data.temp !== null ? data.temp : null);

  const invalidFields: string[] = [];
  let bpmValid = true;
  let spo2Valid = true;
  let tempValid = true;

  if (hr !== null && !isNaN(hr)) {
    if (hr < 20 || hr > 220) {
      bpmValid = false;
      invalidFields.push("Heart Rate");
    }
  }

  if (o2 !== null && !isNaN(o2)) {
    if (o2 < 70 || o2 > 100) {
      spo2Valid = false;
      invalidFields.push("Blood Oxygen");
    }
  }

  if (temp !== null && !isNaN(temp)) {
    if (temp < 30 || temp > 45) {
      tempValid = false;
      invalidFields.push("Core Temperature");
    }
  }

  return {
    isValid: bpmValid && spo2Valid && tempValid,
    bpmValid,
    spo2Valid,
    tempValid,
    invalidFields
  };
}
