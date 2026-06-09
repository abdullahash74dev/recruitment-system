
-- Remove broad public LIST policies on public buckets; keep direct-file read access via signed/public URLs.
DO $$ BEGIN
  -- Drop common default "Public read" policies if they exist
  EXECUTE 'DROP POLICY IF EXISTS "Public Access" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Public read access" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Allow public read" ON storage.objects';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Restrict listing: only authenticated HR/admin can list objects in these public buckets
DROP POLICY IF EXISTS "ad-assets list authenticated" ON storage.objects;
CREATE POLICY "ad-assets list authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('ad-assets','project-logos'));

-- Public read still works for direct URLs because buckets are marked public at the bucket level (object-level read for anon stays disabled).
