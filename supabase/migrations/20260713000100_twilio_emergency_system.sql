-- SQL Migration for Twilio Emergency Communication System
-- Date: 2026-07-13

-- Drop tables if they exist to prevent conflicts
DROP TABLE IF EXISTS notification_logs CASCADE;
DROP TABLE IF EXISTS emergency_centers CASCADE;
DROP TABLE IF EXISTS emergency_contacts CASCADE;

-- Re-create emergency_contacts with exact columns
CREATE TABLE emergency_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    contact_name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    whatsapp_number TEXT,
    contact_type TEXT, -- e.g., 'primary', 'secondary'
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create emergency_centers table
CREATE TABLE emergency_centers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_name TEXT NOT NULL,
    contact_person TEXT,
    phone_number TEXT NOT NULL,
    whatsapp_number TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create notification_logs table
CREATE TABLE notification_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    receiver TEXT NOT NULL, -- Name or phone number
    channel TEXT NOT NULL, -- 'sms', 'whatsapp', 'voice'
    status TEXT NOT NULL, -- 'sent', 'failed', 'delivered'
    message_id TEXT,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Enable Read/Write access on emergency_contacts for assigned Patient/Doctor
CREATE POLICY "Users view own emergency contacts" ON emergency_contacts
    FOR SELECT TO authenticated USING (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()) OR
        patient_id IN (
            SELECT patient_id FROM doctor_patients 
            WHERE doctor_id = (SELECT id FROM doctors WHERE user_id = auth.uid()) 
            AND status = 'active'
        )
    );

CREATE POLICY "Patients manage own emergency contacts" ON emergency_contacts
    FOR ALL TO authenticated USING (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
    ) WITH CHECK (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
    );

-- Enable Read access on emergency_centers for authenticated users
CREATE POLICY "Allow authenticated select on emergency_centers" ON emergency_centers
    FOR SELECT TO authenticated USING (true);

-- Enable Read/Write access on notification_logs for assigned Patient/Doctor
CREATE POLICY "Users view associated notification logs" ON notification_logs
    FOR SELECT TO authenticated USING (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()) OR
        patient_id IN (
            SELECT patient_id FROM doctor_patients 
            WHERE doctor_id = (SELECT id FROM doctors WHERE user_id = auth.uid()) 
            AND status = 'active'
        )
    );

-- Create Indexes for fast querying
CREATE INDEX idx_emergency_contacts_patient ON emergency_contacts(patient_id);
CREATE INDEX idx_emergency_contacts_priority ON emergency_contacts(priority);
CREATE INDEX idx_notification_logs_patient ON notification_logs(patient_id);
CREATE INDEX idx_notification_logs_alert ON notification_logs(alert_id);
CREATE INDEX idx_notification_logs_channel ON notification_logs(channel);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);

-- Seed the default hospital/ambulance center contact
INSERT INTO emergency_centers (hospital_name, contact_person, phone_number, whatsapp_number, location)
VALUES ('HeartSync Ambulance Dispatch', 'Duty Officer', '+9195737372216', 'whatsapp:+9195737372216', 'Emergency Dispatch Hub')
ON CONFLICT DO NOTHING;

-- Create a function/trigger to auto-seed default family contact for new patients
CREATE OR REPLACE FUNCTION public.seed_default_patient_contact()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.emergency_contacts (
    patient_id, 
    contact_name, 
    relationship, 
    phone_number, 
    whatsapp_number, 
    contact_type, 
    priority
  )
  VALUES (
    new.id,
    'Primary Family Contact',
    'Family',
    '+919550413459',
    'whatsapp:+919550413459',
    'primary',
    1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_patient_created_seed_contact
  AFTER INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_patient_contact();
