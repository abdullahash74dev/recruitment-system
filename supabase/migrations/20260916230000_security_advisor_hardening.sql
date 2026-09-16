-- Responds to Supabase's Security Advisor (linter) WARN-level findings.
-- Each fix below is scoped to findings that are genuinely actionable
-- without risking app breakage; several other flagged functions are
-- deliberately left alone (documented at the bottom) because they're
-- either required by RLS policies themselves or intentionally called
-- directly by authenticated/anon app code with their own internal guards.

-- =========================================================================
-- 1) function_search_path_mutable: pin search_path on the two functions
--    missing it. Neither is SECURITY DEFINER, so the practical risk was
--    low, but pinning it is free and closes the finding.
-- =========================================================================
ALTER FUNCTION public.request_client_ip() SET search_path = public;
ALTER FUNCTION public.talent_pool_set_updated_at() SET search_path = public;

-- =========================================================================
-- 2) public_bucket_allows_listing: project-logos and site-assets are
--    public buckets (public = true), so individual objects already serve
--    via public URL without needing any SELECT policy on storage.objects
--    at all. The broad "Public read ..." SELECT policies only ever added
--    the ability to LIST every file in the bucket -- nothing in the app
--    calls .list() on either bucket, so dropping them is a pure
--    tightening with no functional loss.
-- =========================================================================
DROP POLICY IF EXISTS "Public read project logos" ON storage.objects;
DROP POLICY IF EXISTS "Public read site-assets" ON storage.objects;

-- =========================================================================
-- 3) anon/authenticated_security_definer_function_executable: revoke
--    EXECUTE from functions that should only ever run as a trigger or be
--    called by server-side (service-role) code -- never as a public RPC
--    endpoint. Verified against the actual codebase: none of these are
--    invoked via supabase.rpc(...) from anon/authenticated client code.
-- =========================================================================
-- Trigger-only functions (fire automatically on INSERT/UPDATE/DELETE;
-- calling them directly as an RPC would either error -- they reference
-- trigger-only variables like NEW/OLD -- or do nothing useful).
REVOKE EXECUTE ON FUNCTION public.audit_trigger_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_new_applicant() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_application_submission_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_primary_admin_branding() FROM PUBLIC, anon, authenticated;

-- notify_admins(...): only ever called via supabase.rpc(...) from edge
-- functions using the service-role client (ai-system-doctor,
-- scheduled-backup, restore-backup) -- service_role always retains
-- access regardless of these grants. Left open to anon/authenticated,
-- literally anyone could push an arbitrary fake "urgent" notification
-- (attacker-controlled title/body/link) straight into the admin
-- dashboard's notification feed.
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- cleanup_expired_trash(): maintenance-only; re-asserted here since the
-- advisor still observes it as anon/authenticated-executable despite an
-- earlier migration attempting the same revoke.
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_trash() FROM PUBLIC, anon, authenticated;

-- restore_deleted_item(uuid): genuinely used by the admin Trash Bin via
-- the regular authenticated client (TrashBin.tsx), and already guards
-- itself internally with has_role(auth.uid(),'admin'). Only anon (never
-- legitimately a caller) is revoked; authenticated keeps EXECUTE.
REVOKE EXECUTE ON FUNCTION public.restore_deleted_item(uuid) FROM PUBLIC, anon;

-- =========================================================================
-- Deliberately NOT touched (documented so this isn't re-attempted blindly):
--   - has_role, is_admin_or_hr, has_permission, get_my_client_organization_id,
--     has_hr_form_fill_grant: every RLS policy in this schema calls these to
--     decide access, which requires the querying role (anon/authenticated)
--     to hold EXECUTE on them. Revoking would break RLS evaluation
--     database-wide, not just close a lint warning.
--   - am_i_primary_admin, current_user_email: called directly via
--     supabase.rpc(...) from the authenticated frontend (useUserPermissions.ts
--     and others); each returns only information about the CALLER's own
--     identity/role, so being callable isn't a data-exposure risk.
--   - get_executive_recruitment, find_duplicate_applicant,
--     update_existing_application: intentionally public-facing (a
--     token-gated share link, and the public application form's
--     duplicate-check/resume flow, respectively) -- all three are already
--     rate-limited via check_rate_limit (see 20260613190000/20260614010000).
--   - extension_in_public (pg_net): cosmetic schema-placement finding, not
--     a data-exposure risk. Left alone here since ALTER EXTENSION ... SET
--     SCHEMA on a Supabase-managed extension risks breaking every
--     net.http_post(...) cron job in this project if anything about pg_net's
--     hosting is special-cased on Supabase's platform; not worth the risk
--     for a WARN-level tidiness item.
--   - auth_leaked_password_protection: an Auth *setting*, not a database
--     object -- enable it from the Supabase dashboard (Authentication ->
--     Sign In / Providers -> Password -> "Leaked password protection"),
--     no migration can change it.
-- =========================================================================

NOTIFY pgrst, 'reload schema';
