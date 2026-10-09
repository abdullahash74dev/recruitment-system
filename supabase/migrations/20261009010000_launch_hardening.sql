-- Pre-launch hardening for high-traffic public launch.
--
-- 1. Rate limits on the public apply flow were tuned for "stop a script
--    kiddie" and would reject real applicants in a viral spike: Gulf mobile
--    carriers put hundreds of phones behind one CGNAT IP, so 5 applications
--    per IP per hour starts refusing genuine people almost immediately.
-- 2. A double-submit (double tap, auto-retry after a dropped response, two
--    tabs) could create the same applicant twice: duplicate detection was
--    "SELECT then INSERT" with nothing serializing concurrent inserts.
-- 3. Admin 2FA was enforced only by the React route guard; a leaked admin
--    password used directly against the API bypassed it entirely.
-- 4. Re-assert the résumé bucket is private (an older migration made it
--    public; a later one reverted that, but this project's migration
--    history was repaired by hand once, so don't rely on it having run).
-- 5. Error alerting: let public (anon) visitors' crashes reach error_log
--    (bounded + rate limited), and track which rows were already alerted.
-- 6. New-applicant notifications: collapse a burst into one rolling
--    notification per admin instead of one row per applicant per admin.

-- ---------------------------------------------------------------------------
-- 1. Rate limits
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_application_submission_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip text := public.request_client_ip();
  v_max integer := CASE WHEN v_ip = 'unknown' THEN 5000 ELSE 60 END;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

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
  v_max integer := CASE WHEN v_ip = 'unknown' THEN 10000 ELSE 150 END;
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
  v_max integer := CASE WHEN v_ip = 'unknown' THEN 5000 ELSE 60 END;
BEGIN
  IF NOT public.check_rate_limit('update:' || v_ip, v_max, 3600) THEN
    RAISE EXCEPTION 'Too many requests. Please wait a while before trying again.';
  END IF;

  SELECT * INTO v_existing FROM public.applicants WHERE id = _applicant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Applicant not found';
  END IF;

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

-- ---------------------------------------------------------------------------
-- 2. Double-submit guard
-- ---------------------------------------------------------------------------
-- A hard UNIQUE(email, phone) is not an option: the product deliberately
-- lets a person submit a second, separate application (the "update your
-- previous application?" prompt can be declined), and the existing table
-- already holds historical duplicates that would make the index fail to
-- build. Instead, reject a second public insert for the same email+phone
-- within a short window. The advisory lock (keyed on that identity)
-- serializes concurrent inserts for the same person, so two simultaneous
-- requests can't both pass the check; different people never contend.
-- `a.id <> NEW.id` lets the client safely retry its own insert with the
-- same id after a lost response: that retry falls through to the primary
-- key conflict, which the client treats as "already saved".
CREATE OR REPLACE FUNCTION public.prevent_duplicate_application_burst()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(NEW.email, '')));
  v_phone text := regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g');
BEGIN
  IF auth.role() = 'service_role' OR v_email = '' OR v_phone = '' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('applicant-submit:' || v_email || ':' || v_phone));

  IF EXISTS (
    SELECT 1
    FROM public.applicants a
    WHERE lower(a.email) = v_email
      AND a.created_at > now() - interval '2 minutes'
      AND a.id <> NEW.id
      AND regexp_replace(coalesce(a.phone, ''), '\D', '', 'g') = v_phone
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_SUBMISSION: this application was already received a moment ago';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_duplicate_application_burst() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_applicants_prevent_duplicate_burst ON public.applicants;
CREATE TRIGGER trg_applicants_prevent_duplicate_burst
BEFORE INSERT ON public.applicants
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_application_burst();

-- Supports the window lookup above (existing idx_applicants_email_phone is
-- on (lower(email), phone) without created_at).
CREATE INDEX IF NOT EXISTS idx_applicants_lower_email_created_at
  ON public.applicants (lower(email), created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Server-side admin 2FA
-- ---------------------------------------------------------------------------
-- When site_settings.two_factor_enabled is on, an admin/HR session only
-- counts as privileged if it was established by something other than a
-- bare password (the email OTP step in AdminVerifyPage issues a new
-- session whose JWT `amr` records the OTP method). Only applies when a user
-- is checking *their own* role through their own JWT; service-role calls
-- and edge functions checking another user's role are unaffected.
--
-- Emergency switch (Supabase SQL editor) if admins are ever locked out:
--   UPDATE public.site_settings SET two_factor_enabled = false;
CREATE OR REPLACE FUNCTION public.session_meets_admin_2fa(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS DISTINCT FROM auth.uid()
    OR NOT COALESCE((SELECT bool_or(s.two_factor_enabled) FROM public.site_settings s), false)
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(auth.jwt() -> 'amr') = 'array' THEN auth.jwt() -> 'amr' ELSE '[]'::jsonb END
      ) AS m(entry)
      WHERE COALESCE(
        m.entry ->> 'method',
        CASE WHEN jsonb_typeof(m.entry) = 'string' THEN m.entry #>> '{}' END,
        'password'
      ) <> 'password'
    )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  ) AND public.session_meets_admin_2fa(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_hr(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin', 'hr_manager', 'recruitment_coordinator', 'project_manager')
      AND p.is_active = true
  ) AND public.session_meets_admin_2fa(_user_id)
$$;

GRANT EXECUTE ON FUNCTION public.session_meets_admin_2fa(uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Résumé storage stays private (idempotent re-assertion)
-- ---------------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id IN ('resumes', 'applicant-attachments');

DROP POLICY IF EXISTS "Public can view resumes" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for resumes" ON storage.objects;
DROP POLICY IF EXISTS "Public download specific files from resumes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view resumes" ON storage.objects;
DROP POLICY IF EXISTS "Public can view applicant attachments" ON storage.objects;

DROP POLICY IF EXISTS "HR can view uploaded files" ON storage.objects;
CREATE POLICY "HR can view uploaded files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resumes' AND public.is_admin_or_hr(auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Error log: anon reporting + alert watermark
-- ---------------------------------------------------------------------------
ALTER TABLE public.error_log ADD COLUMN IF NOT EXISTS alerted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_error_log_unalerted
  ON public.error_log (created_at)
  WHERE alerted_at IS NULL;

-- Crashes on the public apply/jobs pages happen to anonymous visitors; they
-- were silently rejected by RLS before, so the most important failures
-- during a launch were invisible.
DROP POLICY IF EXISTS "Anon can insert error events" ON public.error_log;
CREATE POLICY "Anon can insert error events" ON public.error_log
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND alerted_at IS NULL);

GRANT INSERT ON public.error_log TO anon;

-- Bound what any non-service caller can write: truncate oversized fields
-- and silently drop (not error) inserts past a per-IP hourly budget.
CREATE OR REPLACE FUNCTION public.guard_error_log_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NOT public.check_rate_limit('errlog:' || public.request_client_ip(), 120, 3600) THEN
    RETURN NULL;
  END IF;

  NEW.message := left(NEW.message, 2000);
  NEW.stack := left(NEW.stack, 8000);
  NEW.url := left(NEW.url, 1000);
  IF NEW.context IS NOT NULL AND length(NEW.context::text) > 8000 THEN
    NEW.context := jsonb_build_object('truncated', true);
  END IF;
  NEW.alerted_at := NULL;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_error_log_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_error_log_insert ON public.error_log;
CREATE TRIGGER trg_guard_error_log_insert
BEFORE INSERT ON public.error_log
FOR EACH ROW EXECUTE FUNCTION public.guard_error_log_insert();

-- Every 15 minutes: email/webhook a digest of new errors (see the
-- error-alerts edge function). Same shared-secret cron pattern as the
-- other scheduled jobs.
SELECT cron.schedule(
  'error-alerts',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pjopugzttogtpgtcsgbo.supabase.co/functions/v1/error-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.app_secrets WHERE key = 'cron_shared_secret')
    ),
    body := '{"cron": true}'::jsonb
  );
  $$
);

-- ---------------------------------------------------------------------------
-- 6. Collapse new-applicant notifications
-- ---------------------------------------------------------------------------
-- One unread rolling "new applicants (N)" notification per admin, refreshed
-- while applicants keep arriving within 15 minutes of each other. A viral
-- burst (or a 5,000-row import) previously wrote one row per applicant per
-- admin and pushed each one live to every open dashboard.
CREATE OR REPLACE FUNCTION public.notify_admins_new_applicant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_existing_id uuid;
  v_count integer;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
    SELECT n.id, COALESCE((n.metadata ->> 'count')::int, 1)
      INTO v_existing_id, v_count
    FROM public.notifications n
    WHERE n.user_id = r.user_id
      AND n.type = 'new_applicant'
      AND n.is_read = false
      AND n.created_at > now() - interval '15 minutes'
    ORDER BY n.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.notifications SET
        title = 'متقدمون جدد (' || (v_count + 1) || ')',
        body = 'آخرهم: ' || COALESCE(NEW.full_name, '—') || ' • ' || COALESCE(NEW.desired_position, ''),
        link = '/dashboard',
        created_at = now(),
        metadata = metadata || jsonb_build_object('count', v_count + 1, 'applicant_id', NEW.id, 'source', NEW.source)
      WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.notifications(user_id, type, title, body, link, severity, metadata)
      VALUES (r.user_id, 'new_applicant',
        'متقدم جديد: ' || COALESCE(NEW.full_name, '—'),
        COALESCE(NEW.desired_position, '') || ' • ' || COALESCE(NEW.nationality, ''),
        '/dashboard?applicant=' || NEW.id::text,
        'info',
        jsonb_build_object('applicant_id', NEW.id, 'source', NEW.source, 'count', 1));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_admins_new_applicant() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
