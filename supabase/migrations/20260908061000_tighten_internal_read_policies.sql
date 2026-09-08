-- Both sla_config and message_templates are only ever read by internal
-- HR-facing dashboard components (SLADashboard.tsx, MessagingCenter.tsx) --
-- never by the company/client portal. Their "Authenticated read ..."
-- policies used USING (true), which (like talent_pool, fixed separately)
-- also grants read access to company/client accounts, since those are
-- ordinary `authenticated` Supabase users too. Tighten both to
-- is_admin_or_hr() to match every other internal-only table.
DROP POLICY IF EXISTS "Authenticated read sla_config" ON public.sla_config;
CREATE POLICY "HR read sla_config"
  ON public.sla_config
  FOR SELECT
  TO authenticated
  USING (is_admin_or_hr(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read message_templates" ON public.message_templates;
CREATE POLICY "HR read message_templates"
  ON public.message_templates
  FOR SELECT
  TO authenticated
  USING (is_admin_or_hr(auth.uid()));

NOTIFY pgrst, 'reload schema';
