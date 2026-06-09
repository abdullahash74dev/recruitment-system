
INSERT INTO storage.buckets (id, name, public) VALUES ('project-logos','project-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read project logos" ON storage.objects;
CREATE POLICY "Public read project logos" ON storage.objects FOR SELECT USING (bucket_id = 'project-logos');

DROP POLICY IF EXISTS "HR upload project logos" ON storage.objects;
CREATE POLICY "HR upload project logos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-logos' AND public.is_admin_or_hr(auth.uid()));

DROP POLICY IF EXISTS "HR update project logos" ON storage.objects;
CREATE POLICY "HR update project logos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'project-logos' AND public.is_admin_or_hr(auth.uid()));

DROP POLICY IF EXISTS "HR delete project logos" ON storage.objects;
CREATE POLICY "HR delete project logos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-logos' AND public.has_role(auth.uid(), 'admin'::app_role));
