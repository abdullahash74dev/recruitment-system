CREATE POLICY "HR can import applicants"
ON public.applicants
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_hr(auth.uid()));