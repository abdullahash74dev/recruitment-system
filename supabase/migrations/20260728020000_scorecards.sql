-- Interview Scorecards: structured evaluation records tied to applicants.
-- Evaluators rate candidates across four dimensions and record a hire
-- recommendation. Admins can manage all rows; authenticated evaluators
-- can insert their own and update/delete only rows they own.

CREATE TABLE IF NOT EXISTS public.interview_scorecards (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id        uuid        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  evaluator_id        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  evaluator_email     text,
  overall_rating      int         CHECK (overall_rating BETWEEN 1 AND 5),
  communication_rating int        CHECK (communication_rating BETWEEN 1 AND 5),
  technical_rating    int         CHECK (technical_rating BETWEEN 1 AND 5),
  culture_fit_rating  int         CHECK (culture_fit_rating BETWEEN 1 AND 5),
  strengths           text,
  weaknesses          text,
  recommendation      text        CHECK (recommendation IN ('strong_hire','hire','maybe','no_hire','strong_no')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_scorecards ENABLE ROW LEVEL SECURITY;

-- Admins have full access to all scorecards.
CREATE POLICY "Admin manage interview_scorecards"
  ON public.interview_scorecards
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can insert their own scorecards.
CREATE POLICY "Evaluator insert own scorecard"
  ON public.interview_scorecards
  FOR INSERT
  TO authenticated
  WITH CHECK (evaluator_id = auth.uid());

-- Evaluators can view their own scorecards.
CREATE POLICY "Evaluator view own scorecards"
  ON public.interview_scorecards
  FOR SELECT
  TO authenticated
  USING (evaluator_id = auth.uid());

-- Evaluators can update their own scorecards.
CREATE POLICY "Evaluator update own scorecard"
  ON public.interview_scorecards
  FOR UPDATE
  TO authenticated
  USING (evaluator_id = auth.uid())
  WITH CHECK (evaluator_id = auth.uid());

-- Evaluators can delete their own scorecards.
CREATE POLICY "Evaluator delete own scorecard"
  ON public.interview_scorecards
  FOR DELETE
  TO authenticated
  USING (evaluator_id = auth.uid());

-- Performance indexes.
CREATE INDEX IF NOT EXISTS idx_interview_scorecards_applicant
  ON public.interview_scorecards (applicant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_scorecards_evaluator
  ON public.interview_scorecards (evaluator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_scorecards_created
  ON public.interview_scorecards (created_at DESC);

NOTIFY pgrst, 'reload schema';
