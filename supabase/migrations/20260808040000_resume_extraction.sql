-- Stores what the AI extracted from each applicant's résumé file, distinct
-- from the applicant's own fields -- so admins can see "what the résumé
-- says" vs. "what actually got filled in", even for fields extraction
-- found but did NOT auto-apply (because the applicant had already filled
-- that field in themselves -- extraction only fills blanks, never
-- overwrites, see extract-applicant-resume-data).
CREATE TABLE public.applicant_resume_extractions (
  applicant_id uuid PRIMARY KEY REFERENCES public.applicants(id) ON DELETE CASCADE,
  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_fields text[] NOT NULL DEFAULT '{}',
  model text,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  extracted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.applicant_resume_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage résumé extractions"
  ON public.applicant_resume_extractions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Single global on/off switch for the automatic-on-submission extraction
-- (checked by both upload-file before it fires the background call, and by
-- extract-applicant-resume-data itself) -- lets an admin pause the feature
-- from Settings without touching code or redeploying anything.
CREATE TABLE public.resume_extraction_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.resume_extraction_settings (id, enabled) VALUES (true, true);

ALTER TABLE public.resume_extraction_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage résumé extraction settings"
  ON public.resume_extraction_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

NOTIFY pgrst, 'reload schema';
