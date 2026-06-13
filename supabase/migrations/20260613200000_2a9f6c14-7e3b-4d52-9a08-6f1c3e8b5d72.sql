-- Theme separation: the public-facing site (careers pages, application
-- form) needs its own color theme that is completely independent from the
-- admin dashboard's personal appearance preferences, and only the
-- "primary admin" (the founding admin account) may change it.

-- 1) New column: which palette the public site uses. 'custom' (the
--    default) keeps using primary_color/accent_color below, matching the
--    site's current look. Named palettes reuse the same swatches as the
--    admin dashboard's theme picker.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS public_theme_palette text NOT NULL DEFAULT 'custom';

-- 2) The "primary admin" is the longest-standing admin account: the
--    user_roles row with role = 'admin' and the earliest created_at.
--    SECURITY DEFINER so it can be evaluated from triggers and from
--    clients without granting broad read access to user_roles.
CREATE OR REPLACE FUNCTION public.get_primary_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles
  WHERE role = 'admin'::app_role
  ORDER BY created_at ASC, user_id ASC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_primary_admin_id() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_primary_admin_id() FROM anon;

-- 3) Client-callable check used by the UI to show/hide the public theme
--    controls.
CREATE OR REPLACE FUNCTION public.am_i_primary_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND auth.uid() = public.get_primary_admin_id();
$$;

GRANT EXECUTE ON FUNCTION public.am_i_primary_admin() TO authenticated;

-- 4) Server-side enforcement: even though any admin can update
--    site_settings (existing RLS policy), only the primary admin may
--    change the public theme palette or the brand colors that back the
--    'custom' palette. This is the actual security boundary; the UI gate
--    is just for clarity.
CREATE OR REPLACE FUNCTION public.enforce_primary_admin_branding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.public_theme_palette IS DISTINCT FROM OLD.public_theme_palette OR
    NEW.primary_color IS DISTINCT FROM OLD.primary_color OR
    NEW.accent_color IS DISTINCT FROM OLD.accent_color
  ) AND auth.uid() IS DISTINCT FROM public.get_primary_admin_id() THEN
    RAISE EXCEPTION 'Only the primary admin can change the public interface theme';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_primary_admin_branding ON public.site_settings;
CREATE TRIGGER trg_enforce_primary_admin_branding
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_primary_admin_branding();

NOTIFY pgrst, 'reload schema';
