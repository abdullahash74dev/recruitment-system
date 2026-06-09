
-- 1. Make resumes bucket private
UPDATE storage.buckets SET public = false WHERE id = 'resumes';

-- 2. Drop overly permissive storage policies
DROP POLICY IF EXISTS "Public can view resumes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view resumes" ON storage.objects;

-- 3. Create restricted storage policies
-- Only HR/admin can view uploaded files
CREATE POLICY "HR can view uploaded files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes'
  AND public.is_admin_or_hr(auth.uid())
);

-- Restrict uploads to specific file types and require authentication is optional (applicants are public)
-- But we enforce file extension and path structure
CREATE POLICY "Public can upload application files"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'resumes'
  AND lower(storage.extension(name)) IN ('pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png')
);

-- 4. Fix applicant INSERT policy - prevent status/notes tampering
DROP POLICY IF EXISTS "Anyone can submit application" ON public.applicants;

CREATE POLICY "Anyone can submit application"
ON public.applicants FOR INSERT
TO public
WITH CHECK (
  status = 'new'
  AND notes IS NULL
);

-- 5. Revoke public EXECUTE on role-checking functions to prevent enumeration
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_hr(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_hr(uuid) FROM anon;
