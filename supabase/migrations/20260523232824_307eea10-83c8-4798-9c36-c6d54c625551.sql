
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin can read reports" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'reports' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can upload reports" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reports' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete reports" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'reports' AND has_role(auth.uid(), 'admin'::app_role));
