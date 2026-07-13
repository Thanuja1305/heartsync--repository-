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
