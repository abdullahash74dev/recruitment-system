-- Low-credit and subscription-expiry email reminders, checked daily by the
-- check-client-billing-alerts edge function (cron job below).
ALTER TABLE public.client_organizations
  ADD COLUMN IF NOT EXISTS low_credit_threshold int NOT NULL DEFAULT 5,
  -- Edge-triggered flag: true once an alert has fired for the *current*
  -- low-balance episode. Reset to false the moment credits_remaining rises
  -- back above the threshold (a top-up), so the next time it drops below,
  -- a fresh alert fires -- no time-based re-alert window to tune, and it
  -- can never spam the same episode twice.
  ADD COLUMN IF NOT EXISTS low_credit_alert_active boolean NOT NULL DEFAULT false,
  -- Stores the exact expires_at value an expiry reminder was already sent
  -- for. Naturally resets itself the moment an admin renews the org with a
  -- new expires_at (IS DISTINCT FROM the stored value again), with no
  -- separate reset step needed in the renewal flow.
  ADD COLUMN IF NOT EXISTS expiry_alerted_for timestamptz;

SELECT cron.schedule(
  'client-billing-alerts',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pjopugzttogtpgtcsgbo.supabase.co/functions/v1/check-client-billing-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.app_secrets WHERE key = 'cron_shared_secret')
    ),
    body := '{"cron": true}'::jsonb
  );
  $$
);

NOTIFY pgrst, 'reload schema';
