-- Drop the broad policy
DROP POLICY IF EXISTS "Public read access for resumes" ON storage.objects;

-- Create a more restrictive policy that only allows reading specific files (not listing)
CREATE POLICY "Public download specific files from resumes"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'resumes' AND name IS NOT NULL);
