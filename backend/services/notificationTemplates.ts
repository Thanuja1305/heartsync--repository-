export interface PatientDetails {
  name: string;
  age: string | number;
  gender?: string;
  bloodGroup?: string;
  location?: string;
  medicalNotes?: string;
}

export interface VitalsDetails {
  heartRate: number | string;
  spo2: number | string;
  temperature: number | string;
  timestamp: string;
}

export function getWhatsAppTemplate(patient: PatientDetails, vitals: VitalsDetails): string {
  return `*HEARTSYNC EMERGENCY ALERT*\n\n` +
    `Patient: ${patient.name}\n` +
    `Age/Gender: ${patient.age} / ${patient.gender || 'Unknown'}\n` +
    `Blood Group: ${patient.bloodGroup || 'Unknown'}\n` +
    `Location: ${patient.location || 'Hyderabad Hub (Standard Hub Zone)'}\n` +
    `Medical Notes: ${patient.medicalNotes || 'No notes'}\n\n` +
    `Critical condition detected.\n\n` +
    `Current readings:\n` +
    `- Heart Rate: ${vitals.heartRate} BPM\n` +
    `- SpO2: ${vitals.spo2}%\n` +
    `- Temperature: ${vitals.temperature}°C\n` +
    `- Time: ${vitals.timestamp}\n\n` +
    `Doctor has been notified.\n` +
    `Please contact emergency services immediately.`;
}

export function getSMSTemplate(patient: PatientDetails, vitals: VitalsDetails): string {
  return `HEARTSYNC EMERGENCY: Critical status detected for ${patient.name} (${patient.age}y). ` +
    `HR: ${vitals.heartRate} BPM, SpO2: ${vitals.spo2}%, Temp: ${vitals.temperature}°C. ` +
    `Location: ${patient.location || 'Hyderabad Hub'}. Immediate dispatch required.`;
}

export function getVoiceTwiML(patient: PatientDetails, vitals: VitalsDetails): string {
  return `<Response>
    <Say voice="alice" loop="2">
      This is an automated Heart Sync emergency alert. 
      A critical health condition has been detected for patient ${patient.name}, age ${patient.age}. 
      Current vital readings indicate a heart rate of ${vitals.heartRate} beats per minute, and oxygen saturation of ${vitals.spo2} percent. 
      Patient location is ${patient.location || 'Hyderabad Hub'}. 
      Please check the patient and coordinate immediate ambulance dispatch.
    </Say>
  </Response>`;
}
