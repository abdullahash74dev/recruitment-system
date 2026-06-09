
-- 1) Set security_invoker on the recruitment stats view so RLS is enforced as the querying user
ALTER VIEW public.recruitment_job_title_stats SET (security_invoker = true);

-- 2) Tighten audit_log INSERT policy for authenticated users:
--    non-admins can only insert LOGIN/LOGOUT events with NULL summary/new_data/table_name/record_id
DROP POLICY IF EXISTS "Authenticated can insert own app audit events" ON public.audit_log;

CREATE POLICY "Authenticated can insert own app audit events"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND old_data IS NULL
  AND (
    -- Admins/HR may write richer audit events (EXPORT/IMPORT/CUSTOM)
    (
      public.is_admin_or_hr(auth.uid())
      AND action = ANY (ARRAY['LOGIN','LOGOUT','CUSTOM','EXPORT','IMPORT'])
    )
    OR
    -- Regular authenticated users can only log their own LOGIN/LOGOUT with no payload
    (
      action = ANY (ARRAY['LOGIN','LOGOUT'])
      AND new_data IS NULL
      AND summary IS NULL
      AND table_name IS NULL
      AND record_id IS NULL
      AND ip_address IS NULL
    )
  )
);
