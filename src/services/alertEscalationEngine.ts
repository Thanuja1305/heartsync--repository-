export interface VitalsPayload {
  bpm: number;
  spo2: number;
  temperature: number;
  ecgStatus: 'Normal' | 'Irregular' | 'Flatline' | string;
}

export interface AlertStatePayload {
  level: 1 | 2 | 3 | 4;
  status: string;
  timestamp: number;
  is_acknowledged: boolean;
  label?: string;
  dispatchAvailable?: boolean;
}

export interface AlertSeverityResult {
  level: 1 | 2 | 3 | 4;
  status: string;
  triggerPopup: boolean;
  playAudio: boolean;
  continuousSiren?: boolean;
  dispatchAvailable?: boolean;
  label: string;
}

export function evaluateAlertSeverity(vitals: VitalsPayload): AlertSeverityResult {
  return {
    level: 1,
    status: 'Stable',
    triggerPopup: false,
    playAudio: false,
    label: 'Optimal State'
  };
}

export async function triggerExternalWebhooks(patientId: string, alertDetails: any) {}
export async function handleMarkAsFalseAlert(patientId: string, patientName: string = "Active Node") {
  return { success: true, timestamp: Date.now() };
}
export async function handleTriggerEmergencyAlert(patientId: string, patientName: string = "Active Node", vitals?: VitalsPayload) {
  return { success: true, timestamp: Date.now() };
}
