-- Bootstrap: grant the 'admin' role to the initial system administrator
-- (no user previously had a row in user_roles, so nobody could access /admin
-- and nobody could grant roles via the app, since role management itself
-- requires an existing admin).
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'abdullahash745@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
