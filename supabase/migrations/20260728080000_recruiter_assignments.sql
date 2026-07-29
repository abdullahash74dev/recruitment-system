-- Maps an applicant to the recruiter who owns them. One recruiter per applicant
-- (UNIQUE on applicant_id) so re-assigning is an upsert, not a duplicate row.
CREATE TABLE IF NOT EXISTS public.recruiter_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL UNIQUE REFERENCES public.applicants(id) ON DELETE CASCADE,
  recruiter_id uuid,
  recruiter_email text,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.recruiter_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage recruiter_assignments" ON public.recruiter_assignments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Recruiters read own assignments" ON public.recruiter_assignments
  FOR SELECT TO authenticated USING (recruiter_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_recruiter_assignments_recruiter ON public.recruiter_assignments (recruiter_id);

NOTIFY pgrst, 'reload schema';
