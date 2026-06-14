-- Security hardening: rate limiting for public-facing endpoints.
--
-- Today, every anonymous endpoint used by the application form
-- (find_duplicate_applicant, update_existing_application, the applicants
-- insert, and the upload-file edge function) can be called an unlimited
-- number of times from a single source: no cap on spam submissions, no
-- cap on identity-lookup probing, no cap on storage-filling uploads (the
-- client already shows a "too many upload attempts" message, but nothing
-- ever produced it). This adds a small shared fixed-window rate limiter
-- and wires it into each of those entry points.

-- 1) Shared rate-limit storage. RLS is enabled with no policies, so only
--    SECURITY DEFINER functions (owned by postgres) and the service role
--    can read/write it.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  rate_key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 2) Atomic fixed-window check: increments the counter for `_key`, resetting
--    it if the window has elapsed, and returns whether the new count is
--    still within `_max_requests` for the `_window_seconds` window.
CREATE OR REPLACE FUNCTION public.check_rate_limit(_key text, _max_requests integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.rate_limits AS rl (rate_key, window_start, request_count)
  VALUES (_key, now(), 1)
  ON CONFLICT (rate_key) DO UPDATE SET
    request_count = CASE
      WHEN rl.window_start < now() - (_window_seconds || ' seconds')::interval THEN 1
      ELSE rl.request_count + 1
    END,
    window_start = CASE
      WHEN rl.window_start < now() - (_window_seconds || ' seconds')::interval THEN now()
      ELSE rl.window_start
    END
  RETURNING request_count INTO v_count;

  RETURN v_count <= _max_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

-- 3) Best-effort client IP from PostgREST's forwarded request headers.
--    Note: X-Forwarded-For can be influenced by the client, so this is a
--    best-effort key for slowing down casual/automated abuse, not a hard
--    per-device guarantee.
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
END;
$$;

REVOKE ALL ON FUNCTION public.request_client_ip() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_client_ip() TO service_role;

-- 4) New application submissions: max 5 per hour per IP.
CREATE OR REPLACE FUNCTION public.enforce_application_submission_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.check_rate_limit('submit:' || public.request_client_ip(), 5, 3600) THEN
    RAISE EXCEPTION 'Too many submissions from this network. Please wait a while before submitting again.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_applicants_submission_rate_limit ON public.applicants;
CREATE TRIGGER trg_applicants_submission_rate_limit
  BEFORE INSERT ON public.applicants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_application_submission_rate_limit();

-- 5) Duplicate-applicant lookup: max 20 per hour per IP (prevents using this
--    as an identity-enumeration oracle).
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
BEGIN
  IF NOT public.check_rate_limit('lookup:' || public.request_client_ip(), 20, 3600) THEN
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

-- 6) Update-existing-application: max 10 per hour per IP. Keep the rest of
--    this function identical to the latest version (strict identity check,
--    submission_token_hash handling, current_tasks).
CREATE OR REPLACE FUNCTION public.update_existing_application(_applicant_id uuid, _email text, _phone text, _full_name text, _payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.applicants%ROWTYPE;
  v_submission_token_hash text := NULLIF(_payload->>'submission_token_hash', '');
BEGIN
  IF NOT public.check_rate_limit('update:' || public.request_client_ip(), 10, 3600) THEN
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
