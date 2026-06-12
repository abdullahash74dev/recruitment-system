-- Automate the AI System Doctor: history table for automated/manual runs,
-- a periodic health check via pg_cron (reusing the existing
-- app_secrets.cron_shared_secret), and admin notifications when issues
-- are detected.

-- 1) system_doctor_runs: history of automated and manual AI Doctor runs
CREATE TABLE IF NOT EXISTS public.system_doctor_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  health_score integer,
  summary text,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  analyzed_count integer NOT NULL DEFAULT 0,
  client_error_count integer NOT NULL DEFAULT 0,
  triggered_by text NOT NULL DEFAULT 'cron',
  triggered_by_user uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_doctor_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view system_doctor_runs" ON public.system_doctor_runs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin insert system_doctor_runs" ON public.system_doctor_runs
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_system_doctor_runs_created ON public.system_doctor_runs (created_at DESC);

-- 2) Periodic automated health check (every 6 hours), reusing the shared
-- cron secret introduced for scheduled backups.
SELECT cron.schedule(
  'ai-system-doctor-periodic',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://saxuqaybxdsyloauigdv.supabase.co/functions/v1/ai-system-doctor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.app_secrets WHERE key = 'cron_shared_secret')
    ),
    body := '{"cron": true}'::jsonb
  );
  $$
);

NOTIFY pgrst, 'reload schema';
