
-- Create user_permissions table for granular per-user permissions
CREATE TABLE public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  permission_key text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_key)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admin can view all permissions
CREATE POLICY "Admin can view all permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Admin can manage permissions
CREATE POLICY "Admin can insert permissions"
ON public.user_permissions
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update permissions"
ON public.user_permissions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete permissions"
ON public.user_permissions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function to check if a user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT granted FROM public.user_permissions WHERE user_id = _user_id AND permission_key = _permission),
    -- Default permissions based on role
    CASE
      WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN true
      WHEN _permission IN ('view_applicants', 'edit_applicants', 'view_jobs', 'edit_jobs', 'view_projects', 'view_analytics')
        AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('hr_manager', 'recruitment_coordinator')) THEN true
      WHEN _permission IN ('view_applicants', 'view_jobs', 'view_projects', 'view_analytics')
        AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'project_manager') THEN true
      ELSE false
    END
  )
$$;
