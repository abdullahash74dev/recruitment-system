
ALTER TYPE recruitment_status ADD VALUE IF NOT EXISTS 'offer_sent';
ALTER TYPE recruitment_status ADD VALUE IF NOT EXISTS 'offer_signed';
ALTER TYPE recruitment_status ADD VALUE IF NOT EXISTS 'started';

ALTER TABLE public.recruitment_candidates
  ADD COLUMN IF NOT EXISTS offer_sent_date date,
  ADD COLUMN IF NOT EXISTS offer_signed_date date,
  ADD COLUMN IF NOT EXISTS expected_start_date date,
  ADD COLUMN IF NOT EXISTS actual_start_date date,
  ADD COLUMN IF NOT EXISTS batch_label text;

DROP VIEW IF EXISTS public.recruitment_job_title_stats;
CREATE VIEW public.recruitment_job_title_stats AS
SELECT jt.id AS job_title_id,
       jt.project_id,
       p.name_ar AS project_name_ar,
       p.name_en AS project_name_en,
       jt.title_ar,
       jt.title_en,
       jt.target_headcount,
       jt.is_active,
       jt.is_published_to_board,
       count(c.*) FILTER (WHERE c.status::text IN ('hired','started')) AS hired_count,
       count(c.*) FILTER (WHERE c.status::text = 'interviewed') AS interviewed_count,
       count(c.*) FILTER (WHERE c.status::text = 'new') AS awaiting_count,
       count(c.*) FILTER (WHERE c.status::text = 'selected') AS selected_count,
       count(c.*) FILTER (WHERE c.status::text = 'offer_accepted') AS offer_accepted_count,
       count(c.*) FILTER (WHERE c.status::text = 'offer_sent') AS offer_sent_count,
       count(c.*) FILTER (WHERE c.status::text = 'offer_signed') AS offer_signed_count,
       count(c.*) FILTER (WHERE c.status::text = 'started') AS started_count,
       count(c.*) FILTER (WHERE c.status::text = 'rejected') AS rejected_count,
       GREATEST(jt.target_headcount - count(c.*) FILTER (WHERE c.status::text IN ('hired','started'))::integer, 0) AS remaining_gap
  FROM public.recruitment_job_titles jt
  LEFT JOIN public.recruitment_projects p ON p.id = jt.project_id
  LEFT JOIN public.recruitment_candidates c ON c.job_title_id = jt.id
 GROUP BY jt.id, p.name_ar, p.name_en;

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
  IF v_link_id IS NULL THEN RAISE EXCEPTION 'invalid_or_expired_token'; END IF;

  UPDATE public.executive_share_links
    SET last_viewed_at = now(), view_count = view_count + 1
    WHERE id = v_link_id;

  WITH s AS (SELECT * FROM public.recruitment_job_title_stats),
  totals AS (
    SELECT
      COALESCE(SUM(target_headcount),0)::int AS total_target,
      COALESCE(SUM(hired_count),0)::int AS total_hired,
      COALESCE(SUM(interviewed_count),0)::int AS total_interviewed,
      COALESCE(SUM(awaiting_count),0)::int AS total_awaiting,
      COALESCE(SUM(selected_count),0)::int AS total_selected,
      COALESCE(SUM(offer_sent_count),0)::int AS total_offer_sent,
      COALESCE(SUM(offer_signed_count),0)::int AS total_offer_signed,
      COALESCE(SUM(started_count),0)::int AS total_started,
      COALESCE(SUM(rejected_count),0)::int AS total_rejected
    FROM s
  ),
  per_project AS (
    SELECT project_id,
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
    SELECT COALESCE(rr.reason_ar,'—') AS name,
           COALESCE(rr.reason_en, rr.reason_ar,'—') AS name_en,
           COUNT(*)::int AS value
      FROM public.recruitment_candidates c
      LEFT JOIN public.rejection_reasons rr ON rr.id = c.rejected_reason_id
     WHERE c.status::text = 'rejected'
     GROUP BY COALESCE(rr.reason_ar,'—'), COALESCE(rr.reason_en, rr.reason_ar,'—')
  ),
  accepted_list AS (
    SELECT c.full_name, c.nationality, c.status::text AS status,
           c.expected_start_date, c.actual_start_date, c.hire_date, c.batch_label,
           p.name_ar AS project_name_ar, p.name_en AS project_name_en,
           jt.title_ar, jt.title_en
      FROM public.recruitment_candidates c
      LEFT JOIN public.recruitment_projects p ON p.id = c.project_id
      LEFT JOIN public.recruitment_job_titles jt ON jt.id = c.job_title_id
     WHERE c.status::text IN ('selected','offer_sent','offer_signed','offer_accepted','hired','started')
     ORDER BY c.created_at DESC
  ),
  rejected_list AS (
    SELECT c.full_name, c.nationality,
           COALESCE(rr.reason_ar,'—') AS reason_ar,
           COALESCE(rr.reason_en, rr.reason_ar,'—') AS reason_en,
           c.rejected_note, c.batch_label,
           p.name_ar AS project_name_ar, p.name_en AS project_name_en,
           jt.title_ar, jt.title_en
      FROM public.recruitment_candidates c
      LEFT JOIN public.recruitment_projects p ON p.id = c.project_id
      LEFT JOIN public.recruitment_job_titles jt ON jt.id = c.job_title_id
      LEFT JOIN public.rejection_reasons rr ON rr.id = c.rejected_reason_id
     WHERE c.status::text = 'rejected'
     ORDER BY c.created_at DESC
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'per_project', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.target DESC) FROM per_project p), '[]'::jsonb),
    'per_job_title', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.target_headcount DESC) FROM s), '[]'::jsonb),
    'per_status', COALESCE((SELECT jsonb_agg(to_jsonb(ps)) FROM per_status ps), '[]'::jsonb),
    'rejection', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.value DESC) FROM rejection r), '[]'::jsonb),
    'accepted_candidates', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM accepted_list a), '[]'::jsonb),
    'rejected_candidates', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM rejected_list r), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_executive_recruitment(text) TO anon, authenticated;
