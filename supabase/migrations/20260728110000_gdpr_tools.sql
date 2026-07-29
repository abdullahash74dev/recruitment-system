-- Privacy/compliance tooling: how long each entity is retained, and a log of
-- data-subject requests (access / deletion / correction / portability).
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL UNIQUE,
  retention_days int NOT NULL DEFAULT 365,
  action_after text NOT NULL DEFAULT 'archive' CHECK (action_after IN ('anonymize','delete','archive')),
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL CHECK (request_type IN ('access','deletion','correction','portability')),
  requester_email text NOT NULL,
  requester_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','rejected')),
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage data_retention_policies" ON public.data_retention_policies
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage privacy_requests" ON public.privacy_requests
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- A data subject can file a request without an account.
CREATE POLICY "Anon can file privacy request" ON public.privacy_requests
  FOR INSERT TO anon WITH CHECK (status = 'pending');

INSERT INTO public.data_retention_policies (entity_type, retention_days, action_after) VALUES
  ('applicants', 730, 'archive'),
  ('audit_log', 365, 'delete'),
  ('error_log', 90, 'delete'),
  ('notifications', 30, 'delete')
ON CONFLICT (entity_type) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_privacy_requests_status ON public.privacy_requests (status, created_at DESC);

NOTIFY pgrst, 'reload schema';
