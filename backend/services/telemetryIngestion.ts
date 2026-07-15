import { SupabaseClient } from '@supabase/supabase-js';

export interface TelemetryPacket {
    deviceId: string;
    patientId: string;
    timestamp?: string;
    sequence: number;
    battery: number;
    signalQuality: number;
    heartRate: number;
    spo2: number;
    temperature: number;
    ecg: number[];
}

export class TelemetryIngestionService {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        this.supabase = supabaseClient;
    }

    /**
     * Validates the incoming packet against strict physiological and structural limits.
     */
    public validatePacket(packet: TelemetryPacket): boolean {
        // Required fields check
        if (!packet.deviceId || !packet.patientId || packet.sequence === undefined) {
            return false;
        }

        // Physiological limits
        if (packet.heartRate < 20 || packet.heartRate > 220) return false;
        if (packet.spo2 < 70 || packet.spo2 > 100) return false;
        if (packet.temperature < 30 || packet.temperature > 43) return false;

        // Structural limits
        if (!packet.ecg || !Array.isArray(packet.ecg) || packet.ecg.length !== 250) return false;
        
        // Ensure ECG elements are numbers
        if (!packet.ecg.every(val => typeof val === 'number')) return false;

        return true;
    }

    /**
     * Ingests a raw telemetry packet. Rejects invalid data. 
     * Saves valid data into the time-series optimized table.
     */
    public async ingestPacket(packet: TelemetryPacket): Promise<{ success: boolean; error?: string }> {
        if (!this.validatePacket(packet)) {
            return { success: false, error: 'Packet validation failed due to structural or physiological anomalies' };
        }

        try {
            const { error } = await this.supabase.from('telemetry_packets').insert([{
                device_id: packet.deviceId,
                patient_id: packet.patientId,
                timestamp: packet.timestamp || new Date().toISOString(),
                sequence: packet.sequence,
                battery: packet.battery,
                signal_quality: packet.signalQuality,
                heart_rate: packet.heartRate,
                spo2: packet.spo2,
                temperature: packet.temperature,
                ecg: packet.ecg
            }]);

            if (error) {
                console.error('[TelemetryIngestion] DB Insert Error:', error);
                return { success: false, error: 'Database insertion failed' };
            }

            return { success: true };
        } catch (error: any) {
            console.error('[TelemetryIngestion] Unexpected Error:', error);
            return { success: false, error: error.message };
        }
    }
}
