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