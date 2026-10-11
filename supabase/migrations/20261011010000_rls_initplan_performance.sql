-- Fixes "canceling statement due to statement timeout" on the admin
-- dashboard after 20261009010000_launch_hardening.sql.
--
-- Every RLS policy here calls a helper like is_admin_or_hr(auth.uid()).
-- Written that way, Postgres re-runs the helper for EVERY row it checks,
-- and a SECURITY DEFINER function with SET search_path can't be inlined, so
-- each call pays full function-call overhead. The launch-hardening migration
-- made has_role/is_admin_or_hr call a second SECURITY DEFINER function
-- (session_meets_admin_2fa), roughly doubling-then-some the per-row cost:
-- measured on 100k applicant rows, count(*) went from ~1.3s to ~22s, past
-- the 8s statement timeout for the authenticated role.
--
-- Two fixes:
-- 1. Inline the 2FA check into has_role / is_admin_or_hr (no nested
--    function call). Worst case per-row cost is back near the original.
-- 2. Rewrite every public-schema policy so row-independent helper calls are
--    wrapped in (SELECT ...). Postgres then evaluates them once per
--    statement as an InitPlan instead of once per row (Supabase's documented
--    RLS performance pattern). Same result, since the arguments never
--    reference the row. Measured: ~22s -> ~0.02s for the same count(*).

-- ---------------------------------------------------------------------------
-- 1. Inlined helpers (same semantics as 20261009010000)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
  AND (
    NOT COALESCE((SELECT bool_or(s.two_factor_enabled) FROM public.site_settings s), false)
    OR _user_id IS DISTINCT FROM auth.uid()
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(auth.jwt() -> 'amr') = 'array' THEN auth.jwt() -> 'amr' ELSE '[]'::jsonb END
      ) AS m(entry)
      WHERE COALESCE(
        m.entry ->> 'method',
        CASE WHEN jsonb_typeof(m.entry) = 'string' THEN m.entry #>> '{}' END,
        'password'
      ) <> 'password'
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_hr(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin', 'hr_manager', 'recruitment_coordinator', 'project_manager')
      AND p.is_active = true
  )
  AND (
    NOT COALESCE((SELECT bool_or(s.two_factor_enabled) FROM public.site_settings s), false)
    OR _user_id IS DISTINCT FROM auth.uid()
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(auth.jwt() -> 'amr') = 'array' THEN auth.jwt() -> 'amr' ELSE '[]'::jsonb END
      ) AS m(entry)
      WHERE COALESCE(
        m.entry ->> 'method',
        CASE WHEN jsonb_typeof(m.entry) = 'string' THEN m.entry #>> '{}' END,
        'password'
      ) <> 'password'
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- 2. Evaluate row-independent helper calls once per statement
-- ---------------------------------------------------------------------------
-- Only calls whose arguments are auth.uid() plus string literals (or no
-- arguments at all) are wrapped, so nothing that depends on the row is
-- touched. Policies already containing a sub-SELECT are skipped, which also
-- makes this block safe to re-run.
DO $$
DECLARE
  pol record;
  helper_pattern constant text :=
    '((?:public\.)?(?:is_admin_or_hr|has_role|has_permission|has_hr_form_fill_grant)\(auth\.uid\(\)(?:, ''[^'']*''::[a-z_.]+)*\)|(?:public\.)?get_my_client_organization_id\(\))';
  new_qual text;
  new_check text;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    IF pol.qual IS NOT NULL AND position('SELECT' IN upper(pol.qual)) = 0 THEN
      new_qual := regexp_replace(pol.qual, helper_pattern, '(SELECT \1)', 'g');
      IF new_qual IS DISTINCT FROM pol.qual THEN
        EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)', pol.policyname, pol.schemaname, pol.tablename, new_qual);
      END IF;
    END IF;

    IF pol.with_check IS NOT NULL AND position('SELECT' IN upper(pol.with_check)) = 0 THEN
      new_check := regexp_replace(pol.with_check, helper_pattern, '(SELECT \1)', 'g');
      IF new_check IS DISTINCT FROM pol.with_check THEN
        EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)', pol.policyname, pol.schemaname, pol.tablename, new_check);
      END IF;
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
