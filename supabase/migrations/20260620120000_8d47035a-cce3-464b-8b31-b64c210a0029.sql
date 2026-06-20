-- Root cause of "Forbidden"/403 on every AI-powered admin edge function (ai-suggest-synonyms,
-- apply-value-normalization, ai-categorize-jobs, scheduled-backup, ai-provider-status,
-- run-recruitment-report, ai-insights, ai-system-doctor): they all call has_role()/is_admin_or_hr()
-- via a service-role client to bypass RLS. A 2026-04-05 migration revoked EXECUTE on these
-- functions FROM PUBLIC (to stop role enumeration by anon), which also stripped the implicit
-- EXECUTE every role inherits from PUBLIC - including service_role. A later migration
-- (2026-06-11, #7) re-granted EXECUTE to `authenticated` but missed `service_role`, so every
-- admin.rpc("has_role", ...) call from these edge functions has been failing with
-- "permission denied for function has_role" ever since. Each function swallows that RPC error
-- and treats the resulting null/undefined data as "not admin", returning a misleading 403
-- regardless of the caller's actual role.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_hr(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
