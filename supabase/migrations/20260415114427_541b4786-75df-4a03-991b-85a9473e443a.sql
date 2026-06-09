
-- Fix 1: Make resumes bucket private and remove public SELECT policy
UPDATE storage.buckets SET public = false WHERE id = 'resumes';

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public download specific files from resumes" ON storage.objects;

-- Ensure HR/admin can still read files
DROP POLICY IF EXISTS "HR can view uploaded files" ON storage.objects;
CREATE POLICY "HR can view uploaded files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resumes' AND public.is_admin_or_hr(auth.uid()));

-- Fix 2: Update is_admin_or_hr() to check profiles.is_active
CREATE OR REPLACE FUNCTION public.is_admin_or_hr(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin', 'hr_manager', 'recruitment_coordinator', 'project_manager')
      AND p.is_active = true
  )
$$;

-- Fix 3: Tighten custom_answers INSERT policy to only allow answers for recently created applicants
DROP POLICY IF EXISTS "Anyone can submit answers" ON public.custom_answers;
CREATE POLICY "Anyone can submit answers"
ON public.custom_answers FOR INSERT
TO public
WITH CHECK (
  answer IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.applicants a
    WHERE a.id = applicant_id
      AND a.created_at > (now() - interval '1 hour')
  )
);
