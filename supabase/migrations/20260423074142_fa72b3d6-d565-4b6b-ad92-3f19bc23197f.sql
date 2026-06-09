
-- 1) Add expiry date and barcode position controls to job advertisements
ALTER TABLE public.job_advertisements
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS publish_date date DEFAULT CURRENT_DATE;

-- 2) Add training/coop type to job_postings to distinguish regular jobs from training
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS posting_category text NOT NULL DEFAULT 'job';
-- posting_category: 'job' | 'coop' | 'tamheer'

-- 3) Add nationality visibility toggle to site_settings
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS show_nationality_on_jobs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS training_page_title_ar text DEFAULT 'فرص التدريب التعاوني وتمهير',
  ADD COLUMN IF NOT EXISTS training_page_title_en text DEFAULT 'Co-op Training & Tamheer Opportunities',
  ADD COLUMN IF NOT EXISTS training_page_desc_ar text DEFAULT 'انضم لبرامج التدريب التعاوني وتمهير في مجموعة الخولي',
  ADD COLUMN IF NOT EXISTS training_page_desc_en text DEFAULT 'Join our Co-op and Tamheer training programs at AlKholi Group';

-- 4) Allow public to update their own application within a short window (for duplicate update flow)
-- We use a server function instead to prevent abuse. Add an index for fast duplicate lookup.
CREATE INDEX IF NOT EXISTS idx_applicants_email_phone ON public.applicants (lower(email), phone);

-- 5) Function: find existing applicant by email/phone/name match
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
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.full_name, a.email, a.phone, a.desired_position, a.created_at
  FROM public.applicants a
  WHERE lower(trim(a.email)) = lower(trim(_email))
    AND regexp_replace(coalesce(a.phone,''),'\D','','g') = regexp_replace(coalesce(_phone,''),'\D','','g')
    AND lower(trim(a.full_name)) = lower(trim(_full_name))
  ORDER BY a.created_at DESC
  LIMIT 1
$$;

-- 6) Function: update existing applicant (anonymous, with strict identity check)
CREATE OR REPLACE FUNCTION public.update_existing_application(
  _applicant_id uuid,
  _email text,
  _phone text,
  _full_name text,
  _payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.applicants%ROWTYPE;
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
    updated_at = now()
  WHERE id = _applicant_id;

  RETURN _applicant_id;
END;
$$;

-- Grant execute to anon for the duplicate-check + update flow
GRANT EXECUTE ON FUNCTION public.find_duplicate_applicant(text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_existing_application(uuid,text,text,text,jsonb) TO anon, authenticated;
