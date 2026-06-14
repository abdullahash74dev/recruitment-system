-- Hardening for the rate limiter added in 20260613190000: if the caller's
-- IP can't be determined (e.g. request.headers isn't populated the way we
-- expect in this Supabase project), every request would share the same
-- 'unknown' key and a single global ceiling could end up blocking ALL
-- applicants after a handful of submissions. Make IP detection fail safe
-- and fall back to a much higher *global* ceiling (instead of the tight
-- per-IP one) whenever the IP is unknown, so legitimate traffic is never
-- locked out.

CREATE OR REPLACE FUNCTION public.request_client_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_headers text;
  v_ip text;
BEGIN
  v_headers := current_setting('request.headers', true);
  IF v_headers IS NULL OR v_headers = '' THEN
    RETURN 'unknown';
  END IF;

  v_ip := trim(split_part(coalesce(v_headers::json->>'x-forwarded-for', ''), ',', 1));
  IF v_ip = '' THEN
    RETURN 'unknown';
  END IF;

  RETURN v_ip;
EXCEPTION WHEN OTHERS THEN
  RETURN 'unknown';
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_application_submission_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip text := public.request_client_ip();
  v_max integer := CASE WHEN v_ip = 'unknown' THEN 100 ELSE 5 END;
BEGIN
  IF NOT public.check_rate_limit('submit:' || v_ip, v_max, 3600) THEN
    RAISE EXCEPTION 'Too many submissions from this network. Please wait a while before submitting again.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_duplicate_applicant(
  _email text,
  _phone text,
  _full_name text
) RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  desired_position text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip text := public.request_client_ip();
  v_max integer := CASE WHEN v_ip = 'unknown' THEN 200 ELSE 20 END;
BEGIN
  IF NOT public.check_rate_limit('lookup:' || v_ip, v_max, 3600) THEN
    RAISE EXCEPTION 'Too many requests. Please wait a while before trying again.';
  END IF;

  RETURN QUERY
  SELECT a.id, a.full_name, a.email, a.phone, a.desired_position, a.created_at
  FROM public.applicants a
  WHERE lower(trim(a.email)) = lower(trim(_email))
    AND regexp_replace(coalesce(a.phone,''),'\D','','g') = regexp_replace(coalesce(_phone,''),'\D','','g')
    AND lower(trim(a.full_name)) = lower(trim(_full_name))
  ORDER BY a.created_at DESC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_existing_application(_applicant_id uuid, _email text, _phone text, _full_name text, _payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.applicants%ROWTYPE;
  v_submission_token_hash text := NULLIF(_payload->>'submission_token_hash', '');
  v_ip text := public.request_client_ip();
  v_max integer := CASE WHEN v_ip = 'unknown' THEN 150 ELSE 10 END;
BEGIN
  IF NOT public.check_rate_limit('update:' || v_ip, v_max, 3600) THEN
    RAISE EXCEPTION 'Too many requests. Please wait a while before trying again.';
  END IF;

  SELECT * INTO v_existing FROM public.applicants WHERE id = _applicant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Applicant not found';
  END IF;

  -- Strict identity check
  IF lower(trim(v_existing.email)) <> lower(trim(_email))
     OR lower(trim(v_existing.full_name)) <> lower(trim(_full_name))
     OR regexp_replace(coalesce(v_existing.phone,''),'\D','','g') <> regexp_replace(coalesce(_phone,''),'\D','','g')
  THEN
    RAISE EXCEPTION 'Identity mismatch';
  END IF;

  IF v_submission_token_hash IS NOT NULL AND v_submission_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid submission token';
  END IF;

  UPDATE public.applicants SET
    desired_position = COALESCE(_payload->>'desired_position', desired_position),
    job_type = COALESCE(_payload->>'job_type', job_type),
    preferred_city = COALESCE(_payload->>'preferred_city', preferred_city),
    current_city = COALESCE(_payload->>'current_city', current_city),
    has_transport = COALESCE(_payload->>'has_transport', has_transport),
    gender = COALESCE(_payload->>'gender', gender),
    nationality = COALESCE(_payload->>'nationality', nationality),
    birth_date = COALESCE((_payload->>'birth_date')::date, birth_date),
    marital_status = COALESCE(_payload->>'marital_status', marital_status),
    dependents = COALESCE((_payload->>'dependents')::int, dependents),
    education_level = COALESCE(_payload->>'education_level', education_level),
    major = COALESCE(_payload->>'major', major),
    university = COALESCE(_payload->>'university', university),
    graduation_year = COALESCE(_payload->>'graduation_year', graduation_year),
    gpa = COALESCE(_payload->>'gpa', gpa),
    currently_studying = COALESCE(_payload->>'currently_studying', currently_studying),
    current_study = COALESCE(_payload->>'current_study', current_study),
    years_experience = COALESCE(_payload->>'years_experience', years_experience),
    currently_employed = COALESCE(_payload->>'currently_employed', currently_employed),
    current_title = COALESCE(_payload->>'current_title', current_title),
    self_summary = COALESCE(_payload->>'self_summary', self_summary),
    current_tasks = COALESCE(_payload->>'current_tasks', current_tasks),
    other_experience = COALESCE(_payload->>'other_experience', other_experience),
    arabic_level = COALESCE(_payload->>'arabic_level', arabic_level),
    english_level = COALESCE(_payload->>'english_level', english_level),
    other_language = COALESCE(_payload->>'other_language', other_language),
    linkedin = COALESCE(_payload->>'linkedin', linkedin),
    current_salary = COALESCE(_payload->>'current_salary', current_salary),
    expected_salary = COALESCE(_payload->>'expected_salary', expected_salary),
    available_date = COALESCE(_payload->>'available_date', available_date),
    hear_about = COALESCE(_payload->>'hear_about', hear_about),
    resume_url = COALESCE(_payload->>'resume_url', resume_url),
    degree_url = COALESCE(_payload->>'degree_url', degree_url),
    training_certs_url = COALESCE(_payload->>'training_certs_url', training_certs_url),
    other_docs_url = COALESCE(_payload->>'other_docs_url', other_docs_url),
    submission_token_hash = COALESCE(v_submission_token_hash, submission_token_hash),
    updated_at = now()
  WHERE id = _applicant_id;

  RETURN _applicant_id;
END;
$function$;
