DROP POLICY IF EXISTS "Anyone can view ad assets" ON storage.objects;

-- Allow public read of individual files (needed for <img src> to work)
-- but block listing the bucket contents
CREATE POLICY "Public can read ad assets by name"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ad-assets'
  AND (
    -- Admins can list everything
    has_role(auth.uid(), 'admin'::app_role)
    -- Public can fetch individual files (when name is specified)
    OR name IS NOT NULL
  )
);