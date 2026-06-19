-- The submission rate limiter added in 20260613190000 was meant to throttle
-- the *public*, unauthenticated job-application form, but the BEFORE INSERT
-- trigger fires on every row regardless of caller. The HR bulk-import tools
-- (import-applicants, import-applicants-mapped) insert through the
-- service-role client, so a single multi-row import batch burns through the
-- whole hourly quota on its first handful of rows, and every applicant after
-- that fails with "Too many submissions from this network." Exempt
-- service_role inserts, which only ever come from server-side/admin code
-- paths, never real public traffic.
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
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NOT public.check_rate_limit('submit:' || v_ip, v_max, 3600) THEN
    RAISE EXCEPTION 'Too many submissions from this network. Please wait a while before submitting again.';
  END IF;
  RETURN NEW;
END;
$$;
