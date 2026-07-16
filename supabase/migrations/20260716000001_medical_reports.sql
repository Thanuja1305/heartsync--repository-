CREATE TABLE IF NOT EXISTS public.medical_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  report_data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies
ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view their own medical reports"
ON public.medical_reports FOR SELECT
USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Doctors can view medical reports of their assigned patients"
ON public.medical_reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM doctor_patients dp
    WHERE dp.patient_id = medical_reports.patient_id
    AND dp.doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
  )
);
