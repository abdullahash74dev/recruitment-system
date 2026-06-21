-- The nightly backup and periodic AI Doctor cron jobs were created with a
-- copy-pasted project URL (saxuqaybxdsyloauigdv) that does not match this
-- project (pjopugzttogtpgtcsgbo), so both have been calling the wrong
-- project's edge function endpoint since they were first scheduled.

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'nightly-system-backup'),
  command := $$
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

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'ai-system-doctor-periodic'),
  command := $$
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
