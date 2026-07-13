-- HeartSync Core Database Schema Migration
-- Date: 2026-07-13

-- Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS doctor_reviews CASCADE;
DROP TABLE IF EXISTS ai_reports CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS risk_scores CASCADE;
DROP TABLE IF EXISTS ecg_analysis CASCADE;
DROP TABLE IF EXISTS ecg_readings CASCADE;
DROP TABLE IF EXISTS vitals CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS doctor_patients CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS emergency_contacts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS / PROFILES TABLE
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PATIENT DETAILS TABLE
CREATE TABLE patients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    date_of_birth DATE,
    gender TEXT,
    blood_group TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    medical_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. DOCTOR DETAILS TABLE
CREATE TABLE doctors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    specialization TEXT,
    license_number TEXT,
    hospital_name TEXT,
    availability BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. DOCTOR-PATIENT CONNECTION TABLE
CREATE TABLE doctor_patients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    UNIQUE (doctor_id, patient_id)
);

-- 5. DEVICE TABLE
CREATE TABLE devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT UNIQUE NOT NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    device_name TEXT,
    device_type TEXT,
    status TEXT,
    last_connected TIMESTAMP WITH TIME ZONE,
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. LIVE VITALS TABLE
CREATE TABLE vitals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    heart_rate INTEGER,
    spo2 FLOAT,
    temperature FLOAT,
    respiratory_rate FLOAT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. ECG RAW DATA TABLE
CREATE TABLE ecg_readings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    raw_value FLOAT NOT NULL,
    sampling_rate INTEGER NOT NULL
);

-- 8. ECG PROCESSED DATA TABLE
CREATE TABLE ecg_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    cleaned_signal JSONB,
    r_peaks JSONB,
    bpm FLOAT,
    hrv FLOAT,
    signal_quality FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. HEALTH SCORES TABLE
CREATE TABLE risk_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('normal', 'warning', 'critical')),
    risk_score FLOAT NOT NULL,
    confidence FLOAT NOT NULL,
    model_version TEXT NOT NULL
);

-- 10. ALERTS TABLE
CREATE TABLE alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'emergency')),
    message TEXT NOT NULL,
    triggered_value JSONB,
    status TEXT NOT NULL CHECK (status IN ('active', 'resolved', 'cancelled')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. AI ANALYSIS TABLE
CREATE TABLE ai_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE NOT NULL,
    summary TEXT NOT NULL,
    explanation TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. DOCTOR REVIEWS TABLE
CREATE TABLE doctor_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE NOT NULL,
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('confirmed', 'dismissed', 'follow_up_required')),
    notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. EMERGENCY CONTACT TABLE
CREATE TABLE emergency_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone TEXT NOT NULL
);

-- ================= INDEXES FOR OPTIMIZED QUERY SPEED =================

-- patient_id indexes
CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_doctors_user_id ON doctors(user_id);
CREATE INDEX idx_doctor_patients_patient ON doctor_patients(patient_id);
CREATE INDEX idx_doctor_patients_doctor ON doctor_patients(doctor_id);
CREATE INDEX idx_devices_patient ON devices(patient_id);
CREATE INDEX idx_vitals_patient ON vitals(patient_id);
CREATE INDEX idx_ecg_readings_patient ON ecg_readings(patient_id);
CREATE INDEX idx_ecg_analysis_patient ON ecg_analysis(patient_id);
CREATE INDEX idx_risk_scores_patient ON risk_scores(patient_id);
CREATE INDEX idx_alerts_patient ON alerts(patient_id);
CREATE INDEX idx_ai_reports_patient ON ai_reports(patient_id);
CREATE INDEX idx_emergency_contacts_patient ON emergency_contacts(patient_id);

-- device_id indexes
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_vitals_device ON vitals(device_id);
CREATE INDEX idx_ecg_readings_device ON ecg_readings(device_id);

-- timestamp/created_at indexes for time-series loading speed
CREATE INDEX idx_vitals_timestamp ON vitals(timestamp DESC);
CREATE INDEX idx_ecg_readings_timestamp ON ecg_readings(timestamp DESC);
CREATE INDEX idx_ecg_analysis_timestamp ON ecg_analysis(timestamp DESC);
CREATE INDEX idx_risk_scores_timestamp ON risk_scores(timestamp DESC);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

-- status & severity indexes for triage dashboards
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);

-- ================= ROW LEVEL SECURITY (RLS) POLICIES =================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecg_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecg_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Allow authenticated users to read all profiles" ON profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to insert own profile" ON profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to update own profile" ON profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. Patients Policies
CREATE POLICY "Patients/Doctors view patient record" ON patients
    FOR SELECT TO authenticated USING (
        user_id = auth.uid() OR 
        id IN (
            SELECT patient_id FROM doctor_patients 
            WHERE doctor_id = (SELECT id FROM doctors WHERE user_id = auth.uid()) 
            AND status = 'active'
        )
    );

CREATE POLICY "Patients insert own record" ON patients
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Patients update own record" ON patients
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Doctors Policies
CREATE POLICY "Doctors/Patients view doctor record" ON doctors
    FOR SELECT TO authenticated USING (
        user_id = auth.uid() OR 
        id IN (
            SELECT doctor_id FROM doctor_patients 
            WHERE patient_id = (SELECT id FROM patients WHERE user_id = auth.uid())
            AND status = 'active'
        )
    );

CREATE POLICY "Doctors insert own record" ON doctors
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Doctors update own record" ON doctors
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Doctor-Patient Connection Policies
CREATE POLICY "Users view own connections" ON doctor_patients
    FOR SELECT TO authenticated USING (
        doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()) OR
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
    );

CREATE POLICY "Doctors manage connections" ON doctor_patients
    FOR ALL TO authenticated USING (
        doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
    ) WITH CHECK (
        doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
    );

-- 5. Devices Policies
CREATE POLICY "Users view associated devices" ON devices
    FOR SELECT TO authenticated USING (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()) OR
        patient_id IN (
            SELECT patient_id FROM doctor_patients 
            WHERE doctor_id = (SELECT id FROM doctors WHERE user_id = auth.uid()) 
            AND status = 'active'
        )
    );

CREATE POLICY "Authenticated user devices management" ON devices
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Generic Telemetry Policy Generator Helper Macro
-- Tables: vitals, ecg_readings, ecg_analysis, risk_scores, alerts, ai_reports, emergency_contacts

-- Vitals
CREATE POLICY "Users view vitals" ON vitals
    FOR SELECT TO authenticated USING (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()) OR
        patient_id IN (
            SELECT patient_id FROM doctor_patients 
            WHERE doctor_id = (SELECT id FROM doctors WHERE user_id = auth.uid()) 
            AND status = 'active'
        )
    );

CREATE POLICY "Patients insert vitals" ON vitals
    FOR INSERT TO authenticated WITH CHECK (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
    );

-- ECG Readings
CREATE POLICY "Users view ECG" ON ecg_readings
    FOR SELECT TO authenticated USING (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()) OR
        patient_id IN (
            SELECT patient_id FROM doctor_patients 
            WHERE doctor_id = (SELECT id FROM doctors WHERE user_id = auth.uid()) 
            AND status = 'active'
        )
    );

CREATE POLICY "Patients insert ECG" ON ecg_readings
    FOR INSERT TO authenticated WITH CHECK (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
    );

-- ECG Analysis
CREATE POLICY "Users view ECG analysis" ON ecg_analysis
    FOR SELECT TO authenticated USING (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()) OR
        patient_id IN (
            SELECT patient_id FROM doctor_patients 
            WHERE doctor_id = (SELECT id FROM doctors WHERE user_id = auth.uid()) 
            AND status = 'active'
        )
    );

-- Risk Scores
CREATE POLICY "Users view Risk Scores" ON risk_scores
    FOR SELECT TO authenticated USING (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()) OR
        patient_id IN (
            SELECT patient_id FROM doctor_patients 
            WHERE doctor_id = (SELECT id FROM doctors WHERE user_id = auth.uid()) 
            AND status = 'active'
        )
    );

-- Alerts
CREATE POLICY "Users view Alerts" ON alerts
    FOR SELECT TO authenticated USING (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()) OR
        patient_id IN (
            SELECT patient_id FROM doctor_patients 
            WHERE doctor_id = (SELECT id FROM doctors WHERE user_id = auth.uid()) 
            AND status = 'active'
        )
    );

CREATE POLICY "Patients insert alerts" ON alerts
    FOR INSERT TO authenticated WITH CHECK (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
    );

-- AI Reports
CREATE POLICY "Users view AI Reports" ON ai_reports
    FOR SELECT TO authenticated USING (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()) OR
        patient_id IN (
            SELECT patient_id FROM doctor_patients 
            WHERE doctor_id = (SELECT id FROM doctors WHERE user_id = auth.uid()) 
            AND status = 'active'
        )
    );

-- Doctor Reviews
CREATE POLICY "Users view Doctor Reviews" ON doctor_reviews
    FOR SELECT TO authenticated USING (
        doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()) OR
        alert_id IN (
            SELECT id FROM alerts 
            WHERE patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Doctors manage Doctor Reviews" ON doctor_reviews
    FOR ALL TO authenticated USING (
        doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
    ) WITH CHECK (
        doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
    );

-- Emergency Contacts
CREATE POLICY "Users view Emergency Contacts" ON emergency_contacts
    FOR SELECT TO authenticated USING (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()) OR
        patient_id IN (
            SELECT patient_id FROM doctor_patients 
            WHERE doctor_id = (SELECT id FROM doctors WHERE user_id = auth.uid()) 
            AND status = 'active'
        )
    );

CREATE POLICY "Patients manage Emergency Contacts" ON emergency_contacts
    FOR ALL TO authenticated USING (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
    ) WITH CHECK (
        patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
    );

-- ================= REALTIME ENABLEMENT =================

-- Enable Realtime for specific tables in publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vitals, ecg_readings, alerts, risk_scores;
  END IF;
END $$;


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


-- Add user_id column to profiles if not exists (default to id)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
UPDATE profiles SET user_id = id WHERE user_id IS NULL;

-- Create patient_profiles table
CREATE TABLE IF NOT EXISTS patient_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    phone TEXT,
    age INTEGER,
    gender TEXT,
    blood_group TEXT,
    medical_conditions TEXT,
    medications TEXT,
    allergies TEXT,
    family_history TEXT,
    emergency_contact_name TEXT,
    emergency_contact_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create doctor_profiles table
CREATE TABLE IF NOT EXISTS doctor_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    phone TEXT,
    age INTEGER,
    medical_license_id TEXT,
    medical_college TEXT,
    experience_years INTEGER,
    hospital_name TEXT,
    specialization TEXT DEFAULT 'Cardiology',
    medical_document_url TEXT,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Enablement
ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow patient select own profile" ON patient_profiles;
CREATE POLICY "Allow patient select own profile" ON patient_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow patient insert own profile" ON patient_profiles;
CREATE POLICY "Allow patient insert own profile" ON patient_profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow patient update own profile" ON patient_profiles;
CREATE POLICY "Allow patient update own profile" ON patient_profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow doctor select own profile" ON doctor_profiles;
CREATE POLICY "Allow doctor select own profile" ON doctor_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow doctor insert own profile" ON doctor_profiles;
CREATE POLICY "Allow doctor insert own profile" ON doctor_profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow doctor update own profile" ON doctor_profiles;
CREATE POLICY "Allow doctor update own profile" ON doctor_profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow doctors view assigned patients" ON patient_profiles;
CREATE POLICY "Allow doctors view assigned patients" ON patient_profiles
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM doctor_profiles dp
            JOIN doctor_patients dp_conn ON dp_conn.doctor_id = dp.id
            JOIN patients p ON p.id = dp_conn.patient_id
            WHERE dp.user_id = auth.uid() 
              AND p.user_id = patient_profiles.user_id
              AND dp.verification_status = 'approved'
        )
    );


