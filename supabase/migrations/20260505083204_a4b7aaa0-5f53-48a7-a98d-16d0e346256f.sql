
INSERT INTO storage.buckets (id, name, public) VALUES ('applicant-attachments', 'applicant-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view applicant attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'applicant-attachments');

CREATE POLICY "HR can upload applicant attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'applicant-attachments' AND public.is_admin_or_hr(auth.uid()));

CREATE POLICY "Admin can delete applicant attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'applicant-attachments' AND public.has_role(auth.uid(), 'admin'::app_role));
