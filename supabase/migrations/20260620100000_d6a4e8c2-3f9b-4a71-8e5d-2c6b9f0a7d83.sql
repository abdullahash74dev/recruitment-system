-- Repeated imports from the same recurring external source (e.g. a data-bank export that
-- always uses the same column layout) currently require redoing the exact field mapping by
-- hand every single time. The per-job "Resume" feature only helps when that specific job's
-- file + snapshot were saved -- it does nothing for jobs that failed/were interrupted before
-- that feature existed, or for a brand-new file from the same source. Let the mapping/source
-- settings be saved once under a name and reapplied to any future upload instantly.
CREATE TABLE IF NOT EXISTS public.applicant_import_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  mapping_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.applicant_import_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR select import templates" ON public.applicant_import_templates FOR SELECT TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR insert import templates" ON public.applicant_import_templates FOR INSERT TO authenticated WITH CHECK (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR update import templates" ON public.applicant_import_templates FOR UPDATE TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR delete import templates" ON public.applicant_import_templates FOR DELETE TO authenticated USING (is_admin_or_hr(auth.uid()));

CREATE TRIGGER trg_applicant_import_templates_updated_at BEFORE UPDATE ON public.applicant_import_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
