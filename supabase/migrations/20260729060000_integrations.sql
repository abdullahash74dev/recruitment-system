-- Integrations hub + outbound webhooks.
--
-- NOTE ON CREDENTIALS: nothing here stores an API key, token or client secret.
-- Third-party credentials must live as Supabase edge-function secrets so they
-- never reach the browser bundle. `integrations` therefore records *intent*
-- ("we want Workday wired up") plus the human-readable hint naming which secret
-- an admin has to provision; `is_connected` is a flag a person flips, not a
-- live handshake result. `config_hint` exists so the UI can tell an admin what
-- to go create without hard-coding that mapping in the front end.

-- One row per third-party service the recruitment system can talk to. Seeded by
-- this migration and updated in place — the UI never inserts here, which is why
-- `service` is UNIQUE and doubles as the stable programmatic identifier while
-- `display_name` stays freely editable.
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Machine key (snake_case). Referenced by any future edge function that
  -- performs the actual sync, so it must not change once seeded.
  service text NOT NULL,
  display_name text NOT NULL,
  -- Drives the grouping in the integrations tab.
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('hris','payroll','calendar','background_check','esignature','communication','analytics','other')),
  -- Admin-declared intent, not a verified connection. See the header note.
  is_connected boolean DEFAULT false,
  -- Which secret an admin must add as an edge-function secret to make this
  -- integration real, e.g. "WORKDAY_CLIENT_ID + WORKDAY_CLIENT_SECRET".
  config_hint text,
  doc_url text,
  -- Written by whichever job last pulled/pushed data. NULL until a real sync
  -- worker exists — the UI reads it as "never synced".
  last_sync_at timestamptz,
  -- Free-text state from the last sync attempt (error message, record counts).
  status_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service)
);

-- Outbound HTTP notifications fired when a recruitment event happens.
-- `secret_hint` is deliberately a *hint* (e.g. "WEBHOOK_SECRET_ATS"), never the
-- signing secret itself: rows are readable by every admin, so a real secret
-- here would be a credential leak.
CREATE TABLE IF NOT EXISTS public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_url text NOT NULL,
  event_type text NOT NULL
    CHECK (event_type IN ('applicant_created','status_changed','interview_scheduled','offer_sent','candidate_hired')),
  is_active boolean DEFAULT true,
  secret_hint text,
  last_triggered_at timestamptz,
  -- Denormalised lifetime counter. Deliveries are pruned over time; the total
  -- attempts figure should survive that pruning.
  trigger_count int DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Append-only attempt log. ON DELETE CASCADE: a deleted webhook's delivery
-- history has no standalone meaning, and keeping orphans would skew the
-- "deliveries today" stat.
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid REFERENCES public.webhooks(id) ON DELETE CASCADE,
  -- Copied from the webhook at send time: if the webhook is later re-pointed at
  -- a different event, past rows must still say what was actually sent.
  event_type text,
  -- 0 for browser-issued no-cors test pings, where the response is opaque and
  -- the real status code is unreadable by design.
  response_status int,
  success boolean DEFAULT false,
  error_detail text,
  delivered_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage integrations" ON public.integrations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage webhooks" ON public.webhooks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage webhook_deliveries" ON public.webhook_deliveries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_integrations_created ON public.integrations (created_at DESC);
-- The integrations tab groups by category and highlights connected services.
CREATE INDEX IF NOT EXISTS idx_integrations_category ON public.integrations (category);
CREATE INDEX IF NOT EXISTS idx_integrations_connected ON public.integrations (is_connected);

CREATE INDEX IF NOT EXISTS idx_webhooks_created ON public.webhooks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhooks_event ON public.webhooks (event_type);
-- A dispatcher looks up "which live webhooks care about this event" on every
-- domain event, so keep that lookup covered.
CREATE INDEX IF NOT EXISTS idx_webhooks_active_event ON public.webhooks (event_type)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered ON public.webhook_deliveries (delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON public.webhook_deliveries (webhook_id, delivered_at DESC);
-- Failure triage: "show me what broke recently".
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_failed ON public.webhook_deliveries (delivered_at DESC)
  WHERE success = false;

-- Seed the catalogue of supported services. ON CONFLICT DO NOTHING (against the
-- UNIQUE service key) makes re-running the migration safe and, importantly,
-- never resets an `is_connected` flag or a `display_name` an admin has edited.
INSERT INTO public.integrations (service, display_name, category, config_hint, doc_url)
VALUES
  ('workday',            'Workday',              'hris',
   'WORKDAY_CLIENT_ID + WORKDAY_CLIENT_SECRET + WORKDAY_TENANT',
   'https://community.workday.com/sites/default/files/file-hosting/restapi/'),
  ('bamboohr',           'BambooHR',             'hris',
   'BAMBOOHR_API_KEY + BAMBOOHR_SUBDOMAIN',
   'https://documentation.bamboohr.com/docs'),
  ('sap_successfactors', 'SAP SuccessFactors',   'hris',
   'SAP_SF_CLIENT_ID + SAP_SF_CLIENT_SECRET + SAP_SF_API_URL',
   'https://api.sap.com/products/SAPSuccessFactors/apis'),
  ('google_calendar',    'Google Calendar',      'calendar',
   'GOOGLE_CALENDAR_CLIENT_ID + GOOGLE_CALENDAR_CLIENT_SECRET + GOOGLE_CALENDAR_REFRESH_TOKEN',
   'https://developers.google.com/calendar/api/guides/overview'),
  ('outlook_calendar',   'Outlook Calendar',     'calendar',
   'MS_GRAPH_CLIENT_ID + MS_GRAPH_CLIENT_SECRET + MS_GRAPH_TENANT_ID',
   'https://learn.microsoft.com/graph/api/resources/calendar'),
  ('docusign',           'DocuSign',             'esignature',
   'DOCUSIGN_INTEGRATION_KEY + DOCUSIGN_USER_ID + DOCUSIGN_PRIVATE_KEY',
   'https://developers.docusign.com/docs/esign-rest-api/'),
  ('sterling',           'Sterling',             'background_check',
   'STERLING_API_KEY + STERLING_ACCOUNT_ID',
   'https://developer.sterlingcheck.com/'),
  ('twilio',             'Twilio SMS',           'communication',
   'TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER',
   'https://www.twilio.com/docs/messaging/api'),
  ('slack',              'Slack',                'communication',
   'SLACK_BOT_TOKEN + SLACK_DEFAULT_CHANNEL',
   'https://api.slack.com/messaging/sending'),
  ('google_analytics',   'Google Analytics 4',   'analytics',
   'GA4_MEASUREMENT_ID + GA4_API_SECRET',
   'https://developers.google.com/analytics/devguides/collection/protocol/ga4')
ON CONFLICT (service) DO NOTHING;

NOTIFY pgrst, 'reload schema';
