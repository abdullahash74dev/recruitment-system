-- Adds an admin-configurable kill switch for email-based two-factor
-- authentication on /admin and /dashboard logins. Defaults to disabled so
-- this migration does not change current login behavior; an admin opts in
-- via the Settings tab once they've confirmed email delivery works, and can
-- always flip it back off from the site_settings table if email codes ever
-- stop arriving.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
