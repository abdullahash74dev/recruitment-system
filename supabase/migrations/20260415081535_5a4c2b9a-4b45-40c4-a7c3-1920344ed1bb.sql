
-- Add is_active to profiles
ALTER TABLE public.profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Allow admin/HR to view all profiles (for user management)
CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_admin_or_hr(auth.uid()));

-- Drop the existing select policy that's too narrow and recreate it
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow admin to update any profile (for activate/deactivate)
CREATE POLICY "Admin can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admin/HR to view all roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admin and HR can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (is_admin_or_hr(auth.uid()));

-- Users can see their own role
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
