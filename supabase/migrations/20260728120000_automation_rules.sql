-- Pipeline automation: declarative trigger -> action rules evaluated against
-- applicants, plus a run log so every automated change is auditable.
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  trigger_event text NOT NULL CHECK (trigger_event IN ('applicant_created','status_changed','days_in_stage','daily_check')),
  trigger_condition_field text,
  trigger_condition_value text,
  action_type text NOT NULL CHECK (action_type IN ('change_status','send_notification','assign_tag','log_note')),
  action_value text,
  run_count int NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  success boolean NOT NULL DEFAULT true,
  details text,
  ran_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage automation_rules" ON public.automation_rules
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage automation_logs" ON public.automation_logs
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON public.automation_rules (is_active, trigger_event);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON public.automation_logs (rule_id, ran_at DESC);

NOTIFY pgrst, 'reload schema';
