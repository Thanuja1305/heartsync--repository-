-- 1. Modify existing patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS live_location JSONB DEFAULT '{}'::jsonb;

-- 2. Create telemetry_packets Table (Time-Series Optimized)
CREATE TABLE IF NOT EXISTS telemetry_packets (
    packet_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id TEXT NOT NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    sequence BIGINT NOT NULL,
    battery INTEGER CHECK (battery >= 0 AND battery <= 100),
    signal_quality INTEGER,
    heart_rate INTEGER,
    spo2 INTEGER,
    temperature NUMERIC,
    ecg INTEGER[] CHECK (array_length(ecg, 1) = 250)
);

-- Optimized indexes for high-frequency time-series telemetry reads
CREATE INDEX IF NOT EXISTS idx_telemetry_patient_time ON telemetry_packets (patient_id, timestamp DESC);

-- 3. Create incident_logs Table (State-Tracking Matrix)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_state') THEN
        CREATE TYPE incident_state AS ENUM ('PENDING_USER', 'RESOLVED', 'ESCALATED_TO_DOCTOR', 'EMERGENCY_DISPATCHED');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS incident_logs (
    incident_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    current_state incident_state DEFAULT 'PENDING_USER',
    start_time TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_checked_time TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    ai_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_incident_logs_patient_state ON incident_logs (patient_id, current_state);
