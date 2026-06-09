DROP POLICY IF EXISTS "Public can view applicant attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for resumes" ON storage.objects;
DROP POLICY IF EXISTS "Public download specific files from resumes" ON storage.objects;
DROP POLICY IF EXISTS "Public can view resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view resumes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to resumes" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload application files" ON storage.objects;
DROP POLICY IF EXISTS "No direct resume uploads" ON storage.objects;

UPDATE storage.buckets
SET public = false
WHERE id IN ('resumes', 'applicant-attachments');

CREATE POLICY "No direct resume uploads"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

ALTER TABLE public.site_settings DROP COLUMN IF EXISTS delete_pin;