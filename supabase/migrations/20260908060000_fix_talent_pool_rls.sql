-- Fixes a real data-exposure bug: "Authenticated read talent_pool" used
-- USING (true), so any authenticated user -- including company/client
-- accounts (client_users.user_id rows are real auth.users, so they pass
-- `TO authenticated` too) -- could read every talent-pool candidate's PII
-- (name, email, phone, expected salary, internal HR notes). Every other
-- internal-only table in this schema restricts SELECT to
-- is_admin_or_hr(); talent_pool was missed. Company accounts have their
-- own dedicated exposure path (candidate_reveals via reveal-candidate)
-- and should never see this table directly.
DROP POLICY IF EXISTS "Authenticated read talent_pool" ON public.talent_pool;

CREATE POLICY "HR read talent_pool"
  ON public.talent_pool
  FOR SELECT
  TO authenticated
  USING (is_admin_or_hr(auth.uid()));

NOTIFY pgrst, 'reload schema';
