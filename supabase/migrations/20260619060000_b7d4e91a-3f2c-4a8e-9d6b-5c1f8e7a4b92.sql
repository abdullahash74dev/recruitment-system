-- Durable tracking for the flexible applicants import tool, so a long import (tens of
-- thousands of rows) leaves a persistent record even if the browser tab is closed,
-- suspended, or crashes mid-run -- instead of all progress/errors living only in
-- React state and vanishing with the tab.
CREATE TABLE public.applicant_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text,
  source_sheets text[],
  import_source text NOT NULL DEFAULT 'direct',
  source_company text,
  status text NOT NULL DEFAULT 'running',
  total_rows integer NOT NULL DEFAULT 0,
  inserted_rows integer NOT NULL DEFAULT 0,
  updated_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  imported_by uuid,
  imported_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applicant_import_jobs_status_check
    CHECK (status IN ('running', 'completed', 'cancelled', 'failed'))
);

CREATE INDEX idx_applicant_import_jobs_created_at ON public.applicant_import_jobs(created_at DESC);

ALTER TABLE public.applicant_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR view import jobs" ON public.applicant_import_jobs
  FOR SELECT TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR insert import jobs" ON public.applicant_import_jobs
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR update import jobs" ON public.applicant_import_jobs
  FOR UPDATE TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR delete import jobs" ON public.applicant_import_jobs
  FOR DELETE TO authenticated USING (is_admin_or_hr(auth.uid()));

CREATE TRIGGER update_applicant_import_jobs_updated_at
  BEFORE UPDATE ON public.applicant_import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
