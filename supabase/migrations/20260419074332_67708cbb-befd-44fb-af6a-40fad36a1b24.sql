DROP POLICY IF EXISTS "Anyone can submit answers" ON public.custom_answers;

CREATE POLICY "Anyone can submit answers"
ON public.custom_answers
FOR INSERT
TO public
WITH CHECK (
  answer IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.applicants a
    WHERE a.id = custom_answers.applicant_id
      AND a.created_at > (now() - interval '2 minutes')
  )
);