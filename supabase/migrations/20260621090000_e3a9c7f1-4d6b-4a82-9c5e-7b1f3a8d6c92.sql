-- Saved applicant filters: lets HR/admin name and persist a filter combination
-- (field/value criteria) instead of losing it on refresh, and see who created it.
CREATE TABLE IF NOT EXISTS public.saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  result_count INTEGER,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR view saved_filters" ON public.saved_filters
  FOR SELECT TO authenticated USING (is_admin_or_hr(auth.uid()));

CREATE POLICY "HR insert saved_filters" ON public.saved_filters
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_hr(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Owner or admin delete saved_filters" ON public.saved_filters
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
