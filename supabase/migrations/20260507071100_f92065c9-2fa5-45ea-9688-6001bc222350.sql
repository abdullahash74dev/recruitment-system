
-- 1. Realtime channel authorization: only admin/HR can subscribe
DROP POLICY IF EXISTS "Only admin/HR can receive realtime" ON realtime.messages;
CREATE POLICY "Only admin/HR can receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_admin_or_hr(auth.uid()));

-- 2. Explicit deny for anonymous uploads on applicant-attachments
DROP POLICY IF EXISTS "Block anonymous uploads to applicant-attachments" ON storage.objects;
CREATE POLICY "Block anonymous uploads to applicant-attachments"
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO anon
WITH CHECK (bucket_id <> 'applicant-attachments');

-- 3. Tighten anon LOGIN_FAILED audit policy: forbid setting sensitive fields
DROP POLICY IF EXISTS "Anon can insert login failure events" ON public.audit_log;
CREATE POLICY "Anon can insert login failure events"
ON public.audit_log
FOR INSERT
TO anon
WITH CHECK (
  action = 'LOGIN_FAILED'
  AND user_id IS NULL
  AND user_email IS NULL
  AND ip_address IS NULL
  AND old_data IS NULL
  AND new_data IS NULL
  AND table_name IS NULL
  AND record_id IS NULL
);
