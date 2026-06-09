
-- Drop and recreate applicant-attachments storage policies cleanly
DROP POLICY IF EXISTS "HR can read applicant attachments" ON storage.objects;
DROP POLICY IF EXISTS "HR can upload applicant attachments" ON storage.objects;
DROP POLICY IF EXISTS "HR can update applicant attachments" ON storage.objects;
DROP POLICY IF EXISTS "HR can delete applicant attachments" ON storage.objects;

CREATE POLICY "HR can read applicant attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'applicant-attachments' AND is_admin_or_hr(auth.uid()));
CREATE POLICY "HR can upload applicant attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'applicant-attachments' AND is_admin_or_hr(auth.uid()));
CREATE POLICY "HR can update applicant attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'applicant-attachments' AND is_admin_or_hr(auth.uid()));
CREATE POLICY "HR can delete applicant attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'applicant-attachments' AND has_role(auth.uid(), 'admin'::app_role));

UPDATE storage.buckets SET public = false WHERE id = 'applicant-attachments';

-- Audit log policy
DROP POLICY IF EXISTS "Authenticated can insert own audit events" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated can insert own app audit events" ON public.audit_log;
CREATE POLICY "Authenticated can insert own app audit events"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND action IN ('LOGIN','LOGOUT','CUSTOM','EXPORT','IMPORT')
    AND old_data IS NULL
  );

-- Drop public uploads on resumes if any
DROP POLICY IF EXISTS "Public can upload application files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to resumes" ON storage.objects;

-- Revokes
REVOKE EXECUTE ON FUNCTION public.restore_deleted_item(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_trash() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_existing_application(uuid, text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_duplicate_applicant(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.audit_trigger_fn() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
