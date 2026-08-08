-- Caches AI-generated résumé summaries so the same candidate's summary is
-- generated once (ever, across ALL client orgs) instead of re-calling the
-- LLM on every profile view -- this is purely a derived summary of the same
-- non-PII profile fields client-applicant-profile already shows for free
-- (education, experience, languages, salary expectations, self_summary),
-- never phone/email, so there's no reason to scope it per-org.
CREATE TABLE public.applicant_ai_summaries (
  applicant_id uuid PRIMARY KEY REFERENCES public.applicants(id) ON DELETE CASCADE,
  summary_ar text,
  summary_en text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.applicant_ai_summaries ENABLE ROW LEVEL SECURITY;

-- Admin-only direct table access (oversight/cleanup). Client-portal users
-- never query this table directly -- client-ai-resume-summary (service
-- role) reads/writes it on their behalf and returns just the summary text.
CREATE POLICY "Admins manage applicant AI summaries"
  ON public.applicant_ai_summaries
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

NOTIFY pgrst, 'reload schema';
