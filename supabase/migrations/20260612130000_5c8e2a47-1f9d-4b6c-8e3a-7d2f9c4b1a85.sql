-- AI provider configuration: lets an admin choose which AI provider
-- (Google Gemini or Anthropic Claude) powers the system's AI features.
-- The actual API key (GEMINI_API_KEY / ANTHROPIC_API_KEY) is configured
-- separately as a Supabase Edge Function secret; this table only stores
-- the provider *choice*, never any credentials.
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'gemini' CHECK (provider IN ('gemini', 'claude')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.ai_settings (provider) VALUES ('gemini');

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin view ai_settings" ON public.ai_settings
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin update ai_settings" ON public.ai_settings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

NOTIFY pgrst, 'reload schema';
