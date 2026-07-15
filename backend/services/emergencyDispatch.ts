import { SupabaseClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import { Request, Response } from 'express';

export class EmergencyDispatchService {
    private supabase: SupabaseClient;
    private twilioClient: twilio.Twilio;

    constructor(supabaseClient: SupabaseClient) {
        this.supabase = supabaseClient;
        
        const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
        const authToken = process.env.TWILIO_AUTH_TOKEN || '';
        this.twilioClient = twilio(accountSid, authToken);
    }

    public async dispatchEmergency(req: Request, res: Response) {
        try {
            const { incidentId, patientId, doctorId } = req.body;

            if (!incidentId || !patientId) {
                return res.status(400).json({ error: 'incidentId and patientId are required.' });
            }

            // 1. Fetch patient details
            const { data: patientProfile, error: patientError } = await this.supabase
                .from('patients')
                .select('*, profiles(full_name)')
                .eq('id', patientId)
                .single();

            if (patientError || !patientProfile) {
                return res.status(404).json({ error: 'Patient not found' });
            }

            // 2. Fetch latest vitals
            const { data: latestVitals } = await this.supabase
                .from('telemetry_packets')
                .select('heart_rate, spo2')
                .eq('patient_id', patientId)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();

            const name = patientProfile.profiles?.full_name || 'Unknown Patient';
            const location = patientProfile.live_location || { lat: 'Unknown', lng: 'Unknown', address: 'Unknown' };
            const hr = latestVitals?.heart_rate || 'N/A';
            const spo2 = latestVitals?.spo2 || 'N/A';

            // Start the 3 concurrent communication webhooks
            console.log(`[EmergencyDispatch] Initiating dispatch sequence for ${name} (${patientId})`);
            
            // Mark incident as dispatched
            await this.supabase
                .from('incident_logs')
                .update({ current_state: 'EMERGENCY_DISPATCHED', last_checked_time: new Date().toISOString() })
                .eq('incident_id', incidentId);

            await Promise.all([
                this.dispatchAmbulanceWhatsApp(name, patientId, location, hr, spo2),
                this.dispatchAmbulanceVoice(name, location),
                this.dispatchFamilyWhatsAppLoop(name, location.address || 'Unknown', patientProfile.contacts || [])
            ]);

            return res.json({ success: true, message: 'Emergency dispatched successfully via all vectors.' });
            
        } catch (error: any) {
            console.error('[EmergencyDispatch] Failed to dispatch:', error);
            return res.status(500).json({ error: 'Failed to complete emergency dispatch protocol.' });
        }
    }

    private async dispatchAmbulanceWhatsApp(name: string, patientId: string, location: any, hr: any, spo2: any) {
        try {
            const messageBody = `[CRITICAL MEDICAL EMERGENCY] Patient: ${name}. ID: ${patientId}. Requires immediate cardiac life support dispatch. Live Coordinates: ${location.lat}, ${location.lng}. Last Reported Vitals: HR: ${hr} BPM, SpO2: ${spo2}%.`;
            
            const dispatchChannel = process.env.AMBULANCE_DISPATCH_WHATSAPP_NUMBER || '';
            const twilioWhatsAppSender = process.env.TWILIO_WHATSAPP_NUMBER || ''; // e.g. 'whatsapp:+14155238886'

            if (!dispatchChannel || !twilioWhatsAppSender) {
                console.warn('[Dispatch] Skipping Ambulance WhatsApp: missing env configuration.');
                return;
            }

            await this.twilioClient.messages.create({
                body: messageBody,
                from: twilioWhatsAppSender,
                to: dispatchChannel
            });
            console.log(`[Dispatch] WhatsApp to Ambulance completed.`);
        } catch (e) {
            console.error('[Dispatch] Ambulance WhatsApp Vector Failed', e);
        }
    }

    private async dispatchAmbulanceVoice(name: string, location: any) {
        try {
            const dispatchDeskPhone = process.env.AMBULANCE_DISPATCH_PHONE_NUMBER || '';
            const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '';

            if (!dispatchDeskPhone || !twilioPhone) {
                console.warn('[Dispatch] Skipping Ambulance Voice: missing env configuration.');
                return;
            }

            const twiml = `
                <Response>
                    <Say voice="Polly.Matthew-Neural" language="en-US">
                        Emergency medical alert for patient ${name}. Critical cardiac event sustained over five minutes. Dispatching telemetry package to terminal coordinates.
                    </Say>
                </Response>
            `;

            await this.twilioClient.calls.create({
                twiml: twiml,
                to: dispatchDeskPhone,
                from: twilioPhone
            });
            console.log(`[Dispatch] Voice to Ambulance completed.`);
        } catch (e) {
            console.error('[Dispatch] Ambulance Voice Vector Failed', e);
        }
    }

    private async dispatchFamilyWhatsAppLoop(name: string, locationAddress: string, contacts: any[]) {
        try {
            if (!Array.isArray(contacts) || contacts.length === 0) {
                console.warn('[Dispatch] No emergency contacts configured for Family Alert loop.');
                return;
            }

            const twilioWhatsAppSender = process.env.TWILIO_WHATSAPP_NUMBER || '';
            if (!twilioWhatsAppSender) return;

            const promises = contacts.map(contact => {
                if (!contact.phone) return Promise.resolve();

                const messageBody = `[HeartSync Alert] Critical health alert for your family member ${name}. A critical cardiac event has been confirmed by attending clinical staff. An ambulance is currently being routed to their known location: ${locationAddress}.`;

                const toPhone = contact.phone.startsWith('whatsapp:') ? contact.phone : `whatsapp:${contact.phone}`;

                return this.twilioClient.messages.create({
                    body: messageBody,
                    from: twilioWhatsAppSender,
                    to: toPhone
                }).catch(e => console.error(`[Dispatch] Failed Family Alert to ${contact.name}`, e));
            });

            await Promise.all(promises);
            console.log(`[Dispatch] Family Alert Loop completed.`);
        } catch (e) {
            console.error('[Dispatch] Family Alert Loop Failed', e);
        }
    }
}
