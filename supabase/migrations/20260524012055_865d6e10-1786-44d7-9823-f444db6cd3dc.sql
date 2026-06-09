CREATE TABLE IF NOT EXISTS public.dashboard_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own dashboard prefs select"
  ON public.dashboard_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users manage own dashboard prefs insert"
  ON public.dashboard_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own dashboard prefs update"
  ON public.dashboard_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own dashboard prefs delete"
  ON public.dashboard_preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER tg_dashboard_prefs_updated
BEFORE UPDATE ON public.dashboard_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();