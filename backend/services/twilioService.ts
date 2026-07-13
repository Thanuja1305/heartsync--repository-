import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER || "+17623443944";
const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886"; // default sandbox sender

// Instantiating twilio client safely
const getTwilioClient = () => {
  const twilioLib = twilio as any;
  if (twilioLib.default) {
    return twilioLib.default(accountSid, authToken);
  }
  return twilio(accountSid, authToken);
};

export interface TwilioResult {
  success: boolean;
  messageId?: string;
  errorMessage?: string;
}

export async function sendSMS(to: string, body: string): Promise<TwilioResult> {
  try {
    const client = getTwilioClient();
    const formattedTo = to.startsWith("+") ? to : `+${to}`;
    console.log(`[Twilio SMS] Dispatching to ${formattedTo}...`);
    
    const msg = await client.messages.create({
      body,
      to: formattedTo,
      from: fromPhone
    });
    
    console.log(`[Twilio SMS SUCCESS] SID: ${msg.sid}`);
    return { success: true, messageId: msg.sid };
  } catch (error: any) {
    console.error("[Twilio SMS FAILURE]", error);
    return { success: false, errorMessage: error.message || String(error) };
  }
}

export async function sendWhatsAppMessage(to: string, body: string): Promise<TwilioResult> {
  try {
    const client = getTwilioClient();
    
    // Ensure E.164 format and prefix with 'whatsapp:'
    let formattedTo = to.trim();
    if (!formattedTo.startsWith("whatsapp:")) {
      const digits = formattedTo.replace(/\+/g, "");
      formattedTo = `whatsapp:+${digits}`;
    }
    
    console.log(`[Twilio WhatsApp] Dispatching to ${formattedTo} from ${fromWhatsApp}...`);
    
    const msg = await client.messages.create({
      body,
      to: formattedTo,
      from: fromWhatsApp
    });
    
    console.log(`[Twilio WhatsApp SUCCESS] SID: ${msg.sid}`);
    return { success: true, messageId: msg.sid };
  } catch (error: any) {
    console.error("[Twilio WhatsApp FAILURE]", error);
    return { success: false, errorMessage: error.message || String(error) };
  }
}

export async function makeEmergencyCall(to: string, twiml: string): Promise<TwilioResult> {
  try {
    const client = getTwilioClient();
    const formattedTo = to.startsWith("+") ? to : `+${to}`;
    console.log(`[Twilio Voice] Calling ${formattedTo}...`);
    
    const call = await client.calls.create({
      twiml,
      to: formattedTo,
      from: fromPhone
    });
    
    console.log(`[Twilio Voice SUCCESS] SID: ${call.sid}`);
    return { success: true, messageId: call.sid };
  } catch (error: any) {
    console.error("[Twilio Voice FAILURE]", error);
    return { success: false, errorMessage: error.message || String(error) };
  }
}
