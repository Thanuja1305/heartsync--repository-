/**
 * PRODUCTION NOTICE:
 * The IoT simulation (Math.random fake data) has been permanently disabled.
 * This service is retained only for its type definitions.
 *
 * Real telemetry is sourced exclusively from the ESP32 hardware via
 * WebSocket -> Node.js backend -> Firebase RTDB -> React Dashboard.
 *
 * DO NOT re-enable simulation without a clearly scoped developer/demo flag
 * that is NEVER active in a production or patient-facing build.
 */

export interface HealthMetrics {
  heartRate: number;
  spo2: number;
  temperature: number;
  motionStatus: "Normal" | "Elevated" | "Fall Detected" | "Running";
  ecgSignal: number[];
  isEmergency: boolean;
  timestamp: any;
}

/**
 * @deprecated IoT simulation has been permanently disabled for production safety.
 * Calling this function will do nothing and return a no-op cleanup function.
 */
export const startIoTSimulation = (_patientId: string): (() => void) => {
  console.error(
    '%c🚫 [HeartSync PRODUCTION] IoT Simulation is DISABLED. Connect a real ESP32 device.',
    'background: #991b1b; color: #fecaca; padding: 8px 16px; font-size: 14px; font-weight: bold; border-radius: 4px;'
  );
  // Return a no-op cleanup function
  return () => {};
};
