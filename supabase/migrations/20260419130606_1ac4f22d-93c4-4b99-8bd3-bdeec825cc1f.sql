-- 1) Restrict delete_pin exposure: drop public read, split into a public-safe view-style policy
-- Easiest: keep "Anyone can view site settings" but revoke column access to delete_pin from anon/authenticated, allowing admin only.

REVOKE SELECT (delete_pin) ON public.site_settings FROM anon, authenticated;
GRANT SELECT (delete_pin) ON public.site_settings TO authenticated;

-- Use column privileges + RLS: admins can read delete_pin; non-admins still get all other columns.
-- However column-level GRANT to authenticated still lets every authenticated user read it via SELECT *.
-- Solution: only grant the column to service_role; verification happens through edge function.
REVOKE SELECT (delete_pin) ON public.site_settings FROM authenticated;
GRANT SELECT (delete_pin) ON public.site_settings TO service_role;

-- 2) Tighten audit_log INSERT policy: user_id must always equal auth.uid() for authenticated inserts
DROP POLICY IF EXISTS "Authenticated can insert own audit events" ON public.audit_log;
CREATE POLICY "Authenticated can insert own audit events"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 3) Add explicit INSERT policy for deleted_items (deny by default, only service role / definer functions write)
CREATE POLICY "No direct inserts on deleted_items"
ON public.deleted_items
FOR INSERT
TO authenticated, anon
WITH CHECK (false);
