DROP POLICY IF EXISTS "Authenticated can insert into audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Public can insert audit events" ON public.audit_log;

CREATE POLICY "Authenticated can insert own audit events"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR action IN ('LOGIN','LOGOUT','LOGIN_FAILED','CUSTOM'));

CREATE POLICY "Anon can insert login failure events"
  ON public.audit_log FOR INSERT
  TO anon
  WITH CHECK (action = 'LOGIN_FAILED' AND user_id IS NULL);