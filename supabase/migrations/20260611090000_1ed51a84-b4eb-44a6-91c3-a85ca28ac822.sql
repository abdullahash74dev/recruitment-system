-- Bootstrap: grant the 'admin' role to the initial system administrator
-- (no user previously had a row in user_roles, so nobody could access /admin
-- and nobody could grant roles via the app, since role management itself
-- requires an existing admin).
INSERT INTO public.user_roles (user_id, role)
VALUES ('544312b8-daf0-4f11-bc8c-2ddc78b8945c', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
