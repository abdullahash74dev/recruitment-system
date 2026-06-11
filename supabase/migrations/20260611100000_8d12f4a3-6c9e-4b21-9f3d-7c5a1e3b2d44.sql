-- Fix: "permission denied for table user_roles" for all logged-in users.
-- The table was created with RLS policies but without the underlying
-- table-level GRANTs, so authenticated users were rejected before RLS
-- was even evaluated, leaving the admin bootstrap unable to access /admin.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

NOTIFY pgrst, 'reload schema';
