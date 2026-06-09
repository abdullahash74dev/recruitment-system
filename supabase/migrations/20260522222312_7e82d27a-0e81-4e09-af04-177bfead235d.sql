ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS source_company text;

CREATE INDEX IF NOT EXISTS idx_applicants_source ON public.applicants(source);
CREATE INDEX IF NOT EXISTS idx_applicants_source_company ON public.applicants(source_company);