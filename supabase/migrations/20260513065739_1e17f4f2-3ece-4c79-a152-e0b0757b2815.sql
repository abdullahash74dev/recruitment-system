ALTER TABLE public.executive_share_links
  ADD COLUMN IF NOT EXISTS default_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.get_executive_recruitment(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link_id uuid;
  v_prefs jsonb;
  v_result jsonb;
BEGIN
  SELECT id, default_prefs INTO v_link_id, v_prefs FROM public.executive_share_links
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
  per_batch AS (
    SELECT COALESCE(NULLIF(batch_label,''),'—') AS batch,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status::text IN ('hired','started'))::int AS hired,
           COUNT(*) FILTER (WHERE status::text = 'rejected')::int AS rejected,
           COUNT(*) FILTER (WHERE status::text IN ('selected','offer_sent','offer_signed','offer_accepted'))::int AS in_progress
      FROM public.recruitment_candidates
     GROUP BY COALESCE(NULLIF(batch_label,''),'—')
  ),
  monthly_hires AS (
    SELECT to_char(date_trunc('month', COALESCE(actual_start_date, hire_date)), 'YYYY-MM') AS month,
           COUNT(*)::int AS hires
      FROM public.recruitment_candidates
     WHERE status::text IN ('hired','started') AND COALESCE(actual_start_date, hire_date) IS NOT NULL
     GROUP BY 1 ORDER BY 1
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
    'default_prefs', COALESCE(v_prefs, '{}'::jsonb),
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'per_project', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.target DESC) FROM per_project p), '[]'::jsonb),
    'per_job_title', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.target_headcount DESC) FROM s), '[]'::jsonb),
    'per_status', COALESCE((SELECT jsonb_agg(to_jsonb(ps)) FROM per_status ps), '[]'::jsonb),
    'rejection', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.value DESC) FROM rejection r), '[]'::jsonb),
    'per_batch', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.total DESC) FROM per_batch b), '[]'::jsonb),
    'monthly_hires', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM monthly_hires m), '[]'::jsonb),
    'accepted_candidates', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM accepted_list a), '[]'::jsonb),
    'rejected_candidates', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM rejected_list r), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;