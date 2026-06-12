-- Database security review: tighten function-execution privileges.
--
-- 1) notify_admins() is SECURITY DEFINER and inserts an arbitrary
--    notification (caller-controlled title/body/link/severity/metadata)
--    for every admin user. New functions default to PUBLIC EXECUTE in
--    Postgres, and no migration ever restricted this one, so any logged-in
--    user could currently call it directly via PostgREST and push
--    attacker-controlled notifications (including links) into every
--    admin's notification feed. It is only ever called from edge functions
--    via the service-role client, so restrict it to service_role.
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text, text, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.notify_admins(text, text, text, text, text, jsonb) TO service_role;

-- 2) find_duplicate_applicant() / update_existing_application() were
--    designed for anonymous applicants to look up and edit their own
--    previously-submitted application (strict email+phone+full_name
--    identity check, SECURITY DEFINER, search_path pinned). A later
--    broad lockdown migration revoked EXECUTE from anon for several
--    functions at once and unintentionally swept these two up, breaking
--    the public "update my application" flow on the careers site.
--    Restore the originally-intended anon access; the functions'
--    internal identity checks remain the authorization boundary.
GRANT EXECUTE ON FUNCTION public.find_duplicate_applicant(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_existing_application(uuid, text, text, text, jsonb) TO anon;
