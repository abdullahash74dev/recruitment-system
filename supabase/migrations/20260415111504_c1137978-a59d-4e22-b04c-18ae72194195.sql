-- Fix projects SELECT policy to avoid permission error for anonymous users
DROP POLICY IF EXISTS "Anyone can view active projects" ON public.projects;

CREATE POLICY "Anyone can view active projects"
ON public.projects
FOR SELECT
USING (is_active = true);

-- Separate policy for admin/HR to view all projects (including inactive)
CREATE POLICY "Admin can view all projects"
ON public.projects
FOR SELECT
TO authenticated
USING (is_admin_or_hr(auth.uid()));

-- Fix job_postings HEAD request that also fails
-- The existing "Anyone can view active job postings" policy should work, 
-- but let's also check job_postings HEAD count query works for anon
-- (the HEAD request failed too, likely same issue if there's an OR with is_admin_or_hr)
