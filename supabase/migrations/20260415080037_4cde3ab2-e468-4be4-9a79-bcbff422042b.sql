
DROP POLICY "Anyone can submit answers" ON public.custom_answers;
CREATE POLICY "Anyone can submit answers" ON public.custom_answers FOR INSERT TO public WITH CHECK (answer IS NOT NULL);
