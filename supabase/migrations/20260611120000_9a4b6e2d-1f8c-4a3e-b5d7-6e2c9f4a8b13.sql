-- Root-cause fix: this project's tables (user_roles, user_permissions,
-- profiles, etc.) were created without the baseline table-level GRANTs
-- that PostgREST requires for `authenticated`/`service_role` to even reach
-- RLS evaluation. Without these grants every query fails up front with
-- "permission denied for table ...", regardless of how correct the RLS
-- policies are - which is what has been blocking all admin/dashboard access.
--
-- RLS policies remain the real authorization boundary and are unchanged by
-- this migration; these GRANTs only let Postgres get as far as evaluating
-- them. `anon` privileges are intentionally left untouched.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tablename);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Apply the same baseline grants automatically to tables/sequences created
-- in the future, so this class of bug can't recur.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
