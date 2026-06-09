-- Make the resumes bucket public
UPDATE storage.buckets SET public = true WHERE id = 'resumes';

-- Allow public read access to files in the resumes bucket
CREATE POLICY "Public read access for resumes"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'resumes');
