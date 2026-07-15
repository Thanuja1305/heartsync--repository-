import { SupabaseClient } from '@supabase/supabase-js';

export class EscalationEngine {
    private supabase: SupabaseClient;
    private checkIntervalMs = 5000; // Check every 5 seconds
    private intervalId: NodeJS.Timeout | null = null;

    constructor(supabaseClient: SupabaseClient) {
        this.supabase = supabaseClient;
    }

    public start() {
        if (this.intervalId) return;
        console.log('[EscalationEngine] Starting 5-Minute Alert Lifecycle Engine...');
        this.intervalId = setInterval(() => this.processIncidents(), this.checkIntervalMs);
    }

    public stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private isCritical(hr: number, spo2: number): boolean {
        // HR outside 60-100 OR SpO2 < 95%
        // ECG anomaly can be added if processed externally
        return hr < 60 || hr > 100 || spo2 < 95;
    }

    private async processIncidents() {
        try {
            // 1. Process active incidents (Stage 2 & Stage 3)
            const { data: activeIncidents } = await this.supabase
                .from('incident_logs')
                .select('*')
                .eq('current_state', 'PENDING_USER');

            if (activeIncidents && activeIncidents.length > 0) {
                for (const incident of activeIncidents) {
                    await this.evaluateActiveIncident(incident);
                }
            }

            // 2. Identify new incidents (Stage 1)
            // For patients without active incidents, check their latest telemetry
            // We can fetch latest packet per patient (simplified for demonstration)
            const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
            const { data: recentCriticalPackets } = await this.supabase
                .from('telemetry_packets')
                .select('patient_id, heart_rate, spo2')
                .gte('timestamp', thirtySecondsAgo);

            if (recentCriticalPackets) {
                // Group by patient_id to find critical patients without incidents
                const patientIds = [...new Set(recentCriticalPackets.map(p => p.patient_id))];
                
                for (const pid of patientIds) {
                    // Check if already has active incident
                    const isActive = activeIncidents?.find(inc => inc.patient_id === pid);
                    if (!isActive) {
                        const packets = recentCriticalPackets.filter(p => p.patient_id === pid);
                        // Very simple check: if the latest is critical
                        const latest = packets[packets.length - 1];
                        if (latest && this.isCritical(latest.heart_rate, latest.spo2)) {
                            await this.triggerInitialIncident(pid);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('[EscalationEngine] Process Error:', error);
        }
    }

    private async triggerInitialIncident(patientId: string) {
        console.log(`[EscalationEngine] Stage 1: Triggering initial incident for ${patientId}`);
        
        const { error } = await this.supabase.from('incident_logs').insert([{
            patient_id: patientId,
            current_state: 'PENDING_USER',
            start_time: new Date().toISOString(),
            last_checked_time: new Date().toISOString()
        }]);

        if (!error) {
            // Dispatch immediate push notification to User/Patient (Mocked here, could use Supabase Realtime)
            console.log(`[Push Notification -> Patient ${patientId}]: Critical bio-metrics detected. Please sit down, remain still, and take necessary precautions. System is verifying reading stability.`);
            this.broadcastPatientNotification(patientId, "Critical bio-metrics detected. Please sit down, remain still, and take necessary precautions. System is verifying reading stability.");
        }
    }

    private async evaluateActiveIncident(incident: any) {
        const now = Date.now();
        const startTime = new Date(incident.start_time).getTime();
        const durationMs = now - startTime;
        
        // Fetch last 30 seconds of telemetry for this patient to check stability
        const thirtySecondsAgo = new Date(now - 30000).toISOString();
        const { data: recentPackets } = await this.supabase
            .from('telemetry_packets')
            .select('heart_rate, spo2, timestamp, ecg')
            .eq('patient_id', incident.patient_id)
            .gte('timestamp', thirtySecondsAgo)
            .order('timestamp', { ascending: true });

        const hasRecentData = recentPackets && recentPackets.length > 0;
        
        // Stage 2: Scenario A (Vitals Stabilize)
        // If we have data and ALL data in the last 30s is NOT critical
        const isStable = hasRecentData && recentPackets.every(p => !this.isCritical(p.heart_rate, p.spo2));

        if (isStable && durationMs >= 30000) {
            console.log(`[EscalationEngine] Stage 2: Vitals stabilized for ${incident.patient_id}`);
            await this.supabase
                .from('incident_logs')
                .update({ current_state: 'RESOLVED', last_checked_time: new Date().toISOString() })
                .eq('incident_id', incident.incident_id);

            console.log(`[Push Notification -> Patient ${incident.patient_id}]: Biometrics have stabilized. Continuous monitoring resumed.`);
            this.broadcastPatientNotification(incident.patient_id, "Biometrics have stabilized. Continuous monitoring resumed.");
            return;
        }

        // Stage 3: The 5-Minute Doctor Escalation
        const FIVE_MINUTES_MS = 5 * 60 * 1000;
        if (durationMs >= FIVE_MINUTES_MS) {
            console.log(`[EscalationEngine] Stage 3: 5-Minute threshold exceeded for ${incident.patient_id}. Escalating to Doctor.`);
            
            const aiSummary = "Sustained abnormal biometrics (Heart Rate & SpO2) detected over 300 seconds.";
            
            await this.supabase
                .from('incident_logs')
                .update({ 
                    current_state: 'ESCALATED_TO_DOCTOR', 
                    last_checked_time: new Date().toISOString(),
                    ai_summary: aiSummary
                })
                .eq('incident_id', incident.incident_id);

            // Fetch patient meta-records
            const { data: patientProfile } = await this.supabase
                .from('patients')
                .select('*, profiles(full_name)')
                .eq('id', incident.patient_id)
                .single();

            const latestEcg = hasRecentData ? recentPackets[recentPackets.length - 1].ecg : [];

            // Trigger Doctor Portal Stream Event
            const payload = {
                incidentId: incident.incident_id,
                patient: {
                    id: incident.patient_id,
                    name: patientProfile?.profiles?.full_name || 'Unknown',
                    age: patientProfile?.date_of_birth, // Calculate actual age if needed
                    bloodGroup: patientProfile?.blood_group,
                    location: patientProfile?.live_location
                },
                liveEcgWave: latestEcg,
                aiSummary: aiSummary
            };

            console.log(`[Stream Event -> Doctor Portal]: Escalation Handoff for Patient ${incident.patient_id}`, payload);
            this.broadcastDoctorEscalation(payload);
        } else {
            // Still in PENDING_USER, update last checked
            await this.supabase
                .from('incident_logs')
                .update({ last_checked_time: new Date().toISOString() })
                .eq('incident_id', incident.incident_id);
        }
    }

    private broadcastPatientNotification(patientId: string, message: string) {
        // Implementation for application push pathway (e.g. Supabase Realtime broadcast)
        this.supabase.channel(`patient-${patientId}`).send({
            type: 'broadcast',
            event: 'critical_alert',
            payload: { message }
        });
    }

    private broadcastDoctorEscalation(payload: any) {
        // Implementation for Doctor Portal Stream Event
        this.supabase.channel(`doctor-portal-stream`).send({
            type: 'broadcast',
            event: 'doctor_escalation',
            payload: payload
        });
    }
}
