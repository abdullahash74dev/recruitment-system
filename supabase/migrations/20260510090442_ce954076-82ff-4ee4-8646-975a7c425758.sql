
-- Executive share links (a token grants read-only access to aggregated recruitment data)
CREATE TABLE IF NOT EXISTS public.executive_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.executive_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage share links insert" ON public.executive_share_links
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage share links update" ON public.executive_share_links
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage share links delete" ON public.executive_share_links
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "HR view share links" ON public.executive_share_links
  FOR SELECT TO authenticated USING (is_admin_or_hr(auth.uid()));

-- Public RPC: returns aggregated recruitment data when given a valid token
CREATE OR REPLACE FUNCTION public.get_executive_recruitment(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_id uuid;
  v_result jsonb;
BEGIN
  SELECT id INTO v_link_id FROM public.executive_share_links
    WHERE token = p_token AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;
  IF v_link_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_token';
  END IF;

  UPDATE public.executive_share_links
    SET last_viewed_at = now(), view_count = view_count + 1
    WHERE id = v_link_id;

  WITH s AS (
    SELECT * FROM public.recruitment_job_title_stats
  ),
  totals AS (
    SELECT
      COALESCE(SUM(target_headcount),0)::int AS total_target,
      COALESCE(SUM(hired_count),0)::int AS total_hired,
      COALESCE(SUM(interviewed_count),0)::int AS total_interviewed,
      COALESCE(SUM(awaiting_count),0)::int AS total_awaiting,
      COALESCE(SUM(rejected_count),0)::int AS total_rejected
    FROM s
  ),
  per_project AS (
    SELECT
      project_id,
      MAX(project_name_ar) AS project_name_ar,
      MAX(project_name_en) AS project_name_en,
      COALESCE(SUM(target_headcount),0)::int AS target,
      COALESCE(SUM(hired_count),0)::int AS hired,
      COALESCE(SUM(interviewed_count),0)::int AS interviewed,
      COALESCE(SUM(awaiting_count),0)::int AS awaiting,
      COALESCE(SUM(rejected_count),0)::int AS rejected
    FROM s GROUP BY project_id
  ),
  per_status AS (
    SELECT status::text AS status, COUNT(*)::int AS value
    FROM public.recruitment_candidates GROUP BY status
  ),
  rejection AS (
    SELECT COALESCE(rr.reason_ar,'—') AS name, COUNT(*)::int AS value
    FROM public.recruitment_candidates c
    LEFT JOIN public.rejection_reasons rr ON rr.id = c.rejected_reason_id
    WHERE c.status = 'rejected'
    GROUP BY COALESCE(rr.reason_ar,'—')
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'per_project', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.target DESC) FROM per_project p), '[]'::jsonb),
    'per_job_title', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.target_headcount DESC) FROM s), '[]'::jsonb),
    'per_status', COALESCE((SELECT jsonb_agg(to_jsonb(ps)) FROM per_status ps), '[]'::jsonb),
    'rejection', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.value DESC) FROM rejection r), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_executive_recruitment(text) TO anon, authenticated;

-- Trigger to update updated_at not needed (no updated_at column)
