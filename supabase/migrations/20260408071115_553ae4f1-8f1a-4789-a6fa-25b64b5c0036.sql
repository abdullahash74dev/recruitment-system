-- Remove public INSERT policy on resumes bucket - uploads now go through edge function
DROP POLICY IF EXISTS "Anyone can upload resumes" ON storage.objects;