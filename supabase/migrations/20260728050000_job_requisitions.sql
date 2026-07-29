-- Job requisitions with an approval workflow: a hiring manager files a request,
-- an admin approves or rejects it, and approved requisitions become job postings.
CREATE TABLE IF NOT EXISTS public.job_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text,
  headcount int NOT NULL DEFAULT 1,
  justification text,
  required_skills text,
  salary_range_min numeric,
  salary_range_max numeric,
  employment_type text NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  target_start_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','rejected','on_hold','fulfilled')),
  requested_by uuid,
  requested_by_email text,
  approved_by uuid,
  approved_by_email text,
  approved_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_requisitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage job_requisitions" ON public.job_requisitions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own requisitions" ON public.job_requisitions
  FOR SELECT TO authenticated USING (requested_by = auth.uid());

CREATE POLICY "Users create own requisitions" ON public.job_requisitions
  FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_job_requisitions_status ON public.job_requisitions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_requisitions_requester ON public.job_requisitions (requested_by);

NOTIFY pgrst, 'reload schema';
