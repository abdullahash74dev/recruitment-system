-- Fix: "permission denied for function is_admin_or_hr" / "has_role" for
-- authenticated users. A previous migration revoked EXECUTE on these
-- SECURITY DEFINER role-checking functions FROM public (to stop anonymous
-- role enumeration) but never re-granted EXECUTE to `authenticated`.
-- Since RLS policies across user_roles, profiles, storage, projects, etc.
-- evaluate these functions for every SELECT, this broke admin access
-- system-wide regardless of the caller's actual role.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_hr(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
