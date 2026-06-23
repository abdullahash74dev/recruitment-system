-- Repairs schema drift caused by the one-time migration-history repair that
-- ran on 2026-06-18 (see "fix: repair migration history before pushing on
-- first deploy"): that step blanket-marked every migration file present in
-- the repo at the time as already-applied, to work around objects that
-- Lovable had created directly without migration bookkeeping. But the
-- scheduled-backup and AI-doctor migrations (2026-06-12) had been merged
-- into main shortly before that repair ran and were swept into the same
-- "already applied" marking despite never actually executing - so
-- supabase db push has been silently skipping them ever since, and their
-- objects (backup_runs, system_doctor_runs, the backups storage bucket, the
-- cron secret row) never actually got created.
--
-- This migration re-asserts those objects under a new version number (so
-- db push will actually run it) using guards that are safe whether the
-- target already exists, was partially created, or is fully missing.

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

DROP POLICY IF EXISTS "Admin view backup_runs" ON public.backup_runs;
CREATE POLICY "Admin view backup_runs" ON public.backup_runs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin insert backup_runs" ON public.backup_runs;
CREATE POLICY "Admin insert backup_runs" ON public.backup_runs
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admin can read backups" ON storage.objects;
CREATE POLICY "Admin can read backups" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'backups' AND has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin can upload backups" ON storage.objects;
CREATE POLICY "Admin can upload backups" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'backups' AND has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin can delete backups" ON storage.objects;
CREATE POLICY "Admin can delete backups" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'backups' AND has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.app_secrets (key, value)
VALUES ('cron_shared_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

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

DROP POLICY IF EXISTS "Admin view system_doctor_runs" ON public.system_doctor_runs;
CREATE POLICY "Admin view system_doctor_runs" ON public.system_doctor_runs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin insert system_doctor_runs" ON public.system_doctor_runs;
CREATE POLICY "Admin insert system_doctor_runs" ON public.system_doctor_runs
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_system_doctor_runs_created ON public.system_doctor_runs (created_at DESC);

NOTIFY pgrst, 'reload schema';
