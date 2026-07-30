-- SMS / WhatsApp messaging: provider settings, reusable templates and a
-- delivery log. Sending itself happens in the `send-sms` edge function so the
-- provider credentials never reach the browser.

-- ---------------------------------------------------------------------------
-- 1) Provider settings (single logical row, kept as a table so RLS applies)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messaging_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'twilio' CHECK (provider IN ('twilio','unifonic','msegat','whatsapp_cloud')),
  account_sid text,
  sender_id text,
  is_active boolean DEFAULT false,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.messaging_settings IS
  'Non-secret SMS/WhatsApp provider configuration. NEVER store the provider auth token / API key here: it lives only in the Supabase edge-function secrets as SMS_AUTH_TOKEN and is read server-side by the send-sms function. Rows here are readable by any authenticated admin, so anything written to them must be safe to expose.';
COMMENT ON COLUMN public.messaging_settings.account_sid IS
  'Public account identifier (Twilio Account SID / Unifonic AppSid / Msegat username). Not a secret. The matching auth token belongs in the SMS_AUTH_TOKEN edge-function secret.';

-- ---------------------------------------------------------------------------
-- 2) Reusable message templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms','whatsapp')),
  body_ar text,
  body_en text,
  variables text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.message_templates.variables IS
  'Comma-separated placeholder list supported by the body, e.g. "{{name}},{{position}}".';

-- ---------------------------------------------------------------------------
-- 3) Delivery log — one row per outbound message attempt
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid REFERENCES public.applicants(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed')),
  provider_message_id text,
  error_detail text,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.messaging_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage messaging_settings" ON public.messaging_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin manage message_templates" ON public.message_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read message_templates" ON public.message_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage message_log" ON public.message_log
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_messaging_settings_created ON public.messaging_settings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_templates_created ON public.message_templates (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_templates_channel ON public.message_templates (channel, is_active);
CREATE INDEX IF NOT EXISTS idx_message_log_created ON public.message_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_log_status ON public.message_log (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_log_applicant ON public.message_log (applicant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed starter templates (idempotent — matched by name)
-- ---------------------------------------------------------------------------
INSERT INTO public.message_templates (name, channel, body_ar, body_en, variables)
SELECT v.name, v.channel, v.body_ar, v.body_en, v.variables
FROM (VALUES
  (
    'دعوة لمقابلة',
    'sms',
    'مرحباً {{name}}، يسعدنا دعوتك لمقابلة على وظيفة {{position}}. سنتواصل معك لتأكيد الموعد. شكراً لك.',
    'Hello {{name}}, we are pleased to invite you to an interview for the {{position}} role. We will contact you to confirm the time. Thank you.',
    '{{name}},{{position}}'
  ),
  (
    'تأكيد استلام الطلب',
    'sms',
    'مرحباً {{name}}، تم استلام طلبك لوظيفة {{position}} بنجاح. سيقوم فريق التوظيف بمراجعته والتواصل معك.',
    'Hello {{name}}, your application for the {{position}} role has been received. Our recruitment team will review it and get back to you.',
    '{{name}},{{position}}'
  ),
  (
    'اعتذار عن الترشيح',
    'sms',
    'شكراً لك {{name}} على اهتمامك بوظيفة {{position}}. نعتذر عن عدم إمكانية المضي بترشيحك حالياً، ونتمنى لك التوفيق.',
    'Thank you {{name}} for your interest in the {{position}} role. Unfortunately we will not be moving forward with your application at this time. We wish you the best.',
    '{{name}},{{position}}'
  )
) AS v(name, channel, body_ar, body_en, variables)
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_templates t WHERE t.name = v.name
);

NOTIFY pgrst, 'reload schema';
