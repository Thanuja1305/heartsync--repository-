import { createClient } from "@supabase/supabase-js";
import {
  sendSMS,
  sendWhatsAppMessage,
  makeEmergencyCall
} from "./twilioService";
import {
  getWhatsAppTemplate,
  getSMSTemplate,
  getVoiceTwiML,
  PatientDetails,
  VitalsDetails
} from "./notificationTemplates";

// Primary configurations supplied by the user
const DEFAULT_AMBULANCE_NUMBER = "+9195737372216";
const DEFAULT_FAMILY_NUMBER = "+919550413459";

function calculateAge(dobString: string | null): string | number {
  if (!dobString) return "Unknown";
  try {
    const dob = new Date(dobString);
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  } catch (e) {
    return "Unknown";
  }
}

export async function checkEmergencyCondition(
  supabaseClient: any,
  alert: {
    id?: string;
    patient_id: string;
    severity: string;
    message: string;
  },
  vitals: {
    heart_rate: number;
    spo2: number;
    temperature: number;
  },
  signalQualityRating: string
) {
  console.log(`[Emergency Decision] Evaluating alert for patient ${alert.patient_id}. Severity: ${alert.severity}, Signal Quality: ${signalQualityRating}`);

  // STEP 1: Verify emergency decision logic constraints
  const isCritical = alert.severity.toUpperCase() === 'CRITICAL';
  const isSignalReliable = signalQualityRating.toLowerCase() !== 'poor';

  if (!isCritical) {
    console.log('[Emergency Decision] Alert is not CRITICAL. Skipping emergency communication.');
    return;
  }

  if (!isSignalReliable) {
    console.log('[Emergency Decision] Signal quality is POOR (possible artifact). Skipping to prevent false alarm.');
    return;
  }

  try {
    // STEP 2: Fetch Patient Profile, Patient Details, and Contacts from Supabase
    // Fetch patient record linked to profiles
    const { data: patientRecord, error: patientError } = await supabaseClient
      .from('patients')
      .select(`
        id,
        date_of_birth,
        gender,
        blood_group,
        medical_notes,
        profiles (
          full_name,
          email,
          phone
        )
      `)
      .eq('user_id', alert.patient_id)
      .maybeSingle();

    if (patientError) throw patientError;

    const profileData = (patientRecord as any)?.profiles || {};
    const patientUuid = patientRecord ? (patientRecord as any).id : alert.patient_id;

    const patientDetails: PatientDetails = {
      name: profileData.full_name || 'HeartSync Patient',
      age: calculateAge(patientRecord ? (patientRecord as any).date_of_birth : null),
      gender: patientRecord ? (patientRecord as any).gender : 'Not specified',
      bloodGroup: patientRecord ? (patientRecord as any).blood_group : 'Not specified',
      location: 'Hyderabad Hub (Live Tracked Zone)',
      medicalNotes: patientRecord ? (patientRecord as any).medical_notes : 'No clinical alerts configured'
    };

    const vitalsDetails: VitalsDetails = {
      heartRate: vitals.heart_rate,
      spo2: vitals.spo2,
      temperature: vitals.temperature,
      timestamp: new Date().toLocaleTimeString()
    };

    // Fetch specific emergency contacts
    const { data: contacts, error: contactsError } = await supabaseClient
      .from('emergency_contacts')
      .select('*')
      .eq('patient_id', patientUuid);

    const alertContactsList = contacts || [];
    
    // Guarantee default family contact is included for validation
    if (!alertContactsList.some(c => c.phone_number.includes(DEFAULT_FAMILY_NUMBER.replace('+', '')))) {
      alertContactsList.push({
        contact_name: 'Primary Family Contact',
        phone_number: DEFAULT_FAMILY_NUMBER,
        whatsapp_number: `whatsapp:${DEFAULT_FAMILY_NUMBER}`,
        contact_type: 'primary',
        relationship: 'Family'
      });
    }

    // STEP 3: Construct Emergency Message Content
    const whatsappMessage = getWhatsAppTemplate(patientDetails, vitalsDetails);
    const smsMessage = getSMSTemplate(patientDetails, vitalsDetails);
    const voiceTwiML = getVoiceTwiML(patientDetails, vitalsDetails);

    console.log(`[Emergency Decision] Initiating notification sequence to ${alertContactsList.length} contacts and Ambulance Node...`);

    // Helper function to log results to Supabase
    const logNotificationStatus = async (receiver: string, channel: string, status: string, msgId?: string, errorMsg?: string) => {
      try {
        await (supabaseClient.from('notification_logs') as any).insert([{
          alert_id: alert.id || null,
          patient_id: patientUuid,
          receiver: receiver,
          channel: channel,
          status: status,
          message_id: msgId || null,
          error_message: errorMsg || null
        }]);
      } catch (logErr) {
        console.error('Failed to record notification log in DB:', logErr);
      }
    };

    // STEP 4: Trigger Twilio Actions (Failure handling ensures app doesn't crash)
    // A. Dispatch WhatsApp & Voice Alerts to Contacts
    for (const contact of alertContactsList) {
      const targetPhone = contact.phone_number;
      const targetWhatsApp = contact.whatsapp_number || `whatsapp:${targetPhone}`;

      // Dispatch WhatsApp
      const waResult = await sendWhatsAppMessage(targetWhatsApp, whatsappMessage);
      await logNotificationStatus(
        `${contact.contact_name} (${targetWhatsApp})`,
        "whatsapp",
        waResult.success ? "sent" : "failed",
        waResult.messageId,
        waResult.errorMessage
      );

      // SMS Fallback if WhatsApp failed
      if (!waResult.success) {
        console.log(`[Emergency Service] WhatsApp failed to ${contact.contact_name}. Attempting SMS fallback...`);
        const smsResult = await sendSMS(targetPhone, smsMessage);
        await logNotificationStatus(
          `${contact.contact_name} (${targetPhone})`,
          "sms",
          smsResult.success ? "sent" : "failed",
          smsResult.messageId,
          smsResult.errorMessage
        );
      }
    }

    // B. Call Ambulance/Hospital Center directly saying it is for HeartSync emergency
    console.log(`[Emergency Service] Direct Call to Hospital Ambulance Hub at ${DEFAULT_AMBULANCE_NUMBER}...`);
    const callResult = await makeEmergencyCall(DEFAULT_AMBULANCE_NUMBER, voiceTwiML);
    await logNotificationStatus(
      `Ambulance Dispatch Hub (${DEFAULT_AMBULANCE_NUMBER})`,
      "voice",
      callResult.success ? "sent" : "failed",
      callResult.messageId,
      callResult.errorMessage
    );
    
    // Also send WhatsApp alert details to ambulance number
    const ambulanceWaResult = await sendWhatsAppMessage(`whatsapp:${DEFAULT_AMBULANCE_NUMBER}`, whatsappMessage);
    await logNotificationStatus(
      `Ambulance Dispatch Hub (${DEFAULT_AMBULANCE_NUMBER})`,
      "whatsapp",
      ambulanceWaResult.success ? "sent" : "failed",
      ambulanceWaResult.messageId,
      ambulanceWaResult.errorMessage
    );

  } catch (error) {
    console.error("[Emergency Decision Service Error] Telemetry processing failed:", error);
  }
}
