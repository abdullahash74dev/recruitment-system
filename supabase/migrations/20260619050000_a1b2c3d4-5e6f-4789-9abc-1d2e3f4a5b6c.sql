-- Free-form custom fields for imported candidates whose source file has columns that
-- don't match any of the fixed applicant fields (e.g. extra Google Forms questions).
ALTER TABLE public.applicants
  ADD COLUMN extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
