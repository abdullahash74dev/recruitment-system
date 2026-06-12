
-- Allow anonymous applicants to check the status of a previously submitted
-- application without logging in, using the email + phone number they
-- applied with (the same strict identity-check pattern already used by
-- find_duplicate_applicant / update_existing_application). Only a minimal
-- set of fields is returned — no contact details, notes, documents, etc.
CREATE OR REPLACE FUNCTION public.track_application_status(
  _email text,
  _phone text
) RETURNS TABLE (
  id uuid,
  desired_position text,
  status public.applicant_status,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.desired_position, a.status, a.created_at, a.updated_at
  FROM public.applicants a
  WHERE a.email IS NOT NULL AND trim(a.email) <> ''
    AND a.phone IS NOT NULL AND trim(a.phone) <> ''
    AND lower(trim(a.email)) = lower(trim(_email))
    AND regexp_replace(a.phone, '\D', '', 'g') = regexp_replace(coalesce(_phone, ''), '\D', '', 'g')
    AND trim(coalesce(_email, '')) <> ''
    AND regexp_replace(coalesce(_phone, ''), '\D', '', 'g') <> ''
  ORDER BY a.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.track_application_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_application_status(text, text) TO anon, authenticated;
