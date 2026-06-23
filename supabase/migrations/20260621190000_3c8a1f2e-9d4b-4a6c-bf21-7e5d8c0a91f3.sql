-- The nightly backup and periodic AI Doctor cron jobs were created with a
-- copy-pasted project URL (saxuqaybxdsyloauigdv) that does not match this
-- project (pjopugzttogtpgtcsgbo), so both have been calling the wrong
-- project's edge function endpoint since they were first scheduled.
--
-- Re-schedule by job name rather than cron.alter_job(job_id := ...): the
-- latter throws "job_id can not be NULL" if a job has gone missing (e.g. a
-- paused/resumed project can drop pg_cron jobs), whereas cron.schedule()
-- with a job_name upserts - updating the existing job in place, or creating
-- it fresh if it's gone - so this migration self-heals either way.

SELECT cron.schedule(
  'nightly-system-backup',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pjopugzttogtpgtcsgbo.supabase.co/functions/v1/scheduled-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.app_secrets WHERE key = 'cron_shared_secret')
    ),
    body := '{"cron": true}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'ai-system-doctor-periodic',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pjopugzttogtpgtcsgbo.supabase.co/functions/v1/ai-system-doctor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.app_secrets WHERE key = 'cron_shared_secret')
    ),
    body := '{"cron": true}'::jsonb
  );
  $$
);
