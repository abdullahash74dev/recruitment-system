
-- Fix applicants policies
DROP POLICY IF EXISTS "Authenticated users can view applicants" ON public.applicants;
DROP POLICY IF EXISTS "Authenticated users can update applicants" ON public.applicants;

CREATE POLICY "HR can view applicants"
  ON public.applicants FOR SELECT
  TO authenticated
  USING (public.is_admin_or_hr(auth.uid()));

CREATE POLICY "HR can update applicants"
  ON public.applicants FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_hr(auth.uid()));

-- Fix job_postings policies
DROP POLICY IF EXISTS "Authenticated users can manage job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Authenticated users can update job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Authenticated users can delete job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Authenticated users can view all job postings" ON public.job_postings;

CREATE POLICY "HR can manage job postings"
  ON public.job_postings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

CREATE POLICY "HR can update job postings"
  ON public.job_postings FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_hr(auth.uid()));

CREATE POLICY "HR can delete job postings"
  ON public.job_postings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "HR can view all job postings"
  ON public.job_postings FOR SELECT
  TO authenticated
  USING (public.is_admin_or_hr(auth.uid()));
