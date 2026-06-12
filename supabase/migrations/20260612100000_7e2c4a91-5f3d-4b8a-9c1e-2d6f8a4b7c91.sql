-- Scheduled automatic backups: history table, private storage bucket,
-- shared cron secret, and a nightly pg_cron job that invokes the
-- scheduled-backup edge function.

-- 1) backup_runs: history/audit of automated and manual backups
CREATE TABLE IF NOT EXISTS public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'success',
  file_path text,
  file_size bigint,
  tables_summary jsonb,
  error_message text,
  triggered_by text NOT NULL DEFAULT 'cron',
  triggered_by_user uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view backup_runs" ON public.backup_runs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin insert backup_runs" ON public.backup_runs
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2) Private storage bucket for full-system backups (admin-only)
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin can read backups" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'backups' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can upload backups" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'backups' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete backups" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'backups' AND has_role(auth.uid(), 'admin'::app_role));

-- 3) Shared secret used to authenticate pg_cron -> edge function calls.
-- Generated server-side; never stored in source. Reused by future cron jobs
-- (e.g. AI System Doctor automation) via the same app_secrets row.
INSERT INTO public.app_secrets (key, value)
VALUES ('cron_shared_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- 4) Nightly scheduled backup (02:00 server time)
SELECT cron.schedule(
  'nightly-system-backup',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://saxuqaybxdsyloauigdv.supabase.co/functions/v1/scheduled-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.app_secrets WHERE key = 'cron_shared_secret')
    ),
    body := '{"cron": true}'::jsonb
  );
  $$
);

NOTIFY pgrst, 'reload schema';
