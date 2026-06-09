ALTER TABLE public.applicants
ADD COLUMN IF NOT EXISTS submission_token_hash text;

ALTER TABLE public.custom_answers
ADD COLUMN IF NOT EXISTS submission_token_hash text;

CREATE INDEX IF NOT EXISTS idx_applicants_submission_token_hash
ON public.applicants (submission_token_hash);

CREATE INDEX IF NOT EXISTS idx_custom_answers_applicant_token
ON public.custom_answers (applicant_id, submission_token_hash);

DROP POLICY IF EXISTS "Anyone can submit application" ON public.applicants;
CREATE POLICY "Anyone can submit application"
ON public.applicants
FOR INSERT
TO public
WITH CHECK (
  status = 'new'::applicant_status
  AND notes IS NULL
  AND submission_token_hash IS NOT NULL
  AND submission_token_hash ~ '^[a-f0-9]{64}$'
);

DROP POLICY IF EXISTS "Anyone can submit answers" ON public.custom_answers;
CREATE POLICY "Anyone can submit answers"
ON public.custom_answers
FOR INSERT
TO public
WITH CHECK (
  answer IS NOT NULL
  AND submission_token_hash IS NOT NULL
  AND submission_token_hash ~ '^[a-f0-9]{64}$'
  AND EXISTS (
    SELECT 1
    FROM public.applicants a
    WHERE a.id = custom_answers.applicant_id
      AND a.submission_token_hash = custom_answers.submission_token_hash
      AND a.created_at > (now() - interval '10 minutes')
  )
);

DROP POLICY IF EXISTS "Anyone can view active dropdown options" ON public.dropdown_options;
CREATE POLICY "Anyone can view active dropdown options"
ON public.dropdown_options
FOR SELECT
TO public
USING (is_active = true);

DROP POLICY IF EXISTS "HR can view all dropdown options" ON public.dropdown_options;
CREATE POLICY "HR can view all dropdown options"
ON public.dropdown_options
FOR SELECT
TO authenticated
USING (is_admin_or_hr(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view active rejection reasons" ON public.rejection_reasons;
CREATE POLICY "Anyone can view active rejection reasons"
ON public.rejection_reasons
FOR SELECT
TO public
USING (is_active = true);

DROP POLICY IF EXISTS "HR can view all rejection reasons" ON public.rejection_reasons;
CREATE POLICY "HR can view all rejection reasons"
ON public.rejection_reasons
FOR SELECT
TO authenticated
USING (is_admin_or_hr(auth.uid()));