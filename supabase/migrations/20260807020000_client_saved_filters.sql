-- Lets a client-portal user save their current filter/search combination and
-- reload it later with one click. Deliberately a separate table from the
-- admin's `saved_filters` (scoped to is_admin_or_hr()) rather than reusing
-- it -- a client-org user must never see or manage the admin dashboard's
-- saved filters, and vice versa.
CREATE TABLE public.client_saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  search text NOT NULL DEFAULT '',
  search_mode text NOT NULL DEFAULT 'any' CHECK (search_mode IN ('any', 'all')),
  result_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client saved filters"
  ON public.client_saved_filters
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- A client user can see every saved filter belonging to their own
-- organization (shared across teammates, e.g. a filter one colleague set up
-- for "candidates for the Riyadh branch" is useful to the whole team), but
-- may only create/delete rows tied to that same organization and stamped
-- with their own user id.
CREATE POLICY "Clients view own org saved filters"
  ON public.client_saved_filters
  FOR SELECT
  USING (client_organization_id = public.get_my_client_organization_id());

CREATE POLICY "Clients create own org saved filters"
  ON public.client_saved_filters
  FOR INSERT
  WITH CHECK (
    client_organization_id = public.get_my_client_organization_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Clients delete own org saved filters"
  ON public.client_saved_filters
  FOR DELETE
  USING (client_organization_id = public.get_my_client_organization_id());

CREATE INDEX idx_client_saved_filters_org ON public.client_saved_filters(client_organization_id);

NOTIFY pgrst, 'reload schema';
