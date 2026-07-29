-- Per-stage SLA targets. Actual time-in-stage is computed client-side from the
-- applicants table; this table only stores the target/warning thresholds.
CREATE TABLE IF NOT EXISTS public.sla_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL UNIQUE,
  target_days int NOT NULL DEFAULT 7,
  warning_days int NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage sla_config" ON public.sla_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read sla_config" ON public.sla_config
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.sla_config (stage, target_days, warning_days) VALUES
  ('new', 2, 1),
  ('reviewing', 5, 3),
  ('phone_interview', 7, 5),
  ('in_person_interview', 14, 10),
  ('accepted', 3, 2),
  ('hired', 7, 5)
ON CONFLICT (stage) DO NOTHING;

NOTIFY pgrst, 'reload schema';
