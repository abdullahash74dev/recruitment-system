-- Lets a client-portal user turn a saved filter into a standing "email me
-- when a new matching candidate shows up" alert. Checked periodically by
-- the check-saved-filter-alerts edge function (see cron job below); this
-- migration only adds the on/off switch and the watermark used to find
-- "new since last check".
ALTER TABLE public.client_saved_filters
  ADD COLUMN IF NOT EXISTS alert_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_alerted_at timestamptz;

-- The alert checker scans only alert_enabled rows every run; keep that scan
-- cheap regardless of how many saved filters accumulate over time.
CREATE INDEX IF NOT EXISTS idx_client_saved_filters_alert_enabled
  ON public.client_saved_filters (alert_enabled)
  WHERE alert_enabled = true;

-- A client user may flip alert_enabled on their own org's filters (the
-- existing "Clients view/create/delete own org saved filters" policies
-- don't cover UPDATE at all yet).
CREATE POLICY "Clients update own org saved filters"
  ON public.client_saved_filters
  FOR UPDATE
  USING (client_organization_id = public.get_my_client_organization_id())
  WITH CHECK (client_organization_id = public.get_my_client_organization_id());

-- Hourly: look for new applicants matching any alert-enabled saved filter
-- and email whoever created it. Same shared-secret cron pattern as the
-- nightly backup / AI System Doctor jobs.
SELECT cron.schedule(
  'client-saved-filter-alerts',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pjopugzttogtpgtcsgbo.supabase.co/functions/v1/check-saved-filter-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.app_secrets WHERE key = 'cron_shared_secret')
    ),
    body := '{"cron": true}'::jsonb
  );
  $$
);

NOTIFY pgrst, 'reload schema';
