
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL,
  model text,
  user_id uuid,
  user_email text,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  estimated_cost_usd numeric(10,6) DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_code text,
  duration_ms integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created ON public.ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_service ON public.ai_usage_log (service);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view ai usage" ON public.ai_usage_log
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can insert ai usage" ON public.ai_usage_log
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can delete ai usage" ON public.ai_usage_log
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.ai_usage_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL UNIQUE,
  display_name_ar text NOT NULL,
  display_name_en text,
  monthly_cap_usd numeric(10,2) NOT NULL DEFAULT 5,
  warn_threshold_pct integer NOT NULL DEFAULT 80,
  hard_stop boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view ai settings" ON public.ai_usage_settings
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage ai settings ins" ON public.ai_usage_settings
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage ai settings upd" ON public.ai_usage_settings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage ai settings del" ON public.ai_usage_settings
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.ai_usage_settings (service, display_name_ar, display_name_en, monthly_cap_usd, warn_threshold_pct)
VALUES
  ('filter-applicants-ai', 'فلترة المرشحين بالذكاء', 'AI Applicant Filter', 5.00, 80),
  ('ai-doctor', 'طبيب النظام AI', 'AI System Doctor', 2.00, 80)
ON CONFLICT (service) DO NOTHING;
