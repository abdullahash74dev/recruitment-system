-- HR Forms module, workflow phase: per-template fill grants, the issuance
-- ledger, and tightened submission RLS so non-HR users can only fill the
-- specific templates an admin granted them.

-- ---------------------------------------------------------------------------
-- 1) hr_form_template_permissions — admin grants a user fill-only access to
--    one specific template (structure editing stays admin-only).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hr_form_template_permissions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid        NOT NULL REFERENCES public.hr_form_templates(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL,
  can_fill    boolean     NOT NULL DEFAULT true,
  granted_by  uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, user_id)
);

ALTER TABLE public.hr_form_template_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage hr_form_template_permissions"
  ON public.hr_form_template_permissions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- A user can always see their own grants (drives the fill-UI catalog).
CREATE POLICY "User read own hr_form_template_permissions"
  ON public.hr_form_template_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_hr_form_template_permissions_user
  ON public.hr_form_template_permissions (user_id);

CREATE TRIGGER audit_hr_form_template_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.hr_form_template_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- Helper used by RLS below: does this user hold a fill grant for a template?
CREATE OR REPLACE FUNCTION public.has_hr_form_fill_grant(_user_id uuid, _template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hr_form_template_permissions p
    WHERE p.user_id = _user_id AND p.template_id = _template_id AND p.can_fill
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_hr_form_fill_grant(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_hr_form_fill_grant(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Tighten submission INSERT: HR staff fill any published template; other
--    users only templates they hold a grant for.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Requester insert own hr_form_submissions" ON public.hr_form_submissions;
CREATE POLICY "Requester insert own hr_form_submissions"
  ON public.hr_form_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.hr_form_templates t
      WHERE t.id = template_id AND t.status = 'published'
    )
    AND (
      is_admin_or_hr(auth.uid())
      OR has_hr_form_fill_grant(auth.uid(), template_id)
    )
  );

-- Grant-holders need to browse employees to pick who a form is for.
CREATE POLICY "Grant holders read employees"
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.hr_form_template_permissions p
    WHERE p.user_id = auth.uid() AND p.can_fill
  ));

-- Grant-holders also need the published template rows themselves — already
-- covered by the existing "Authenticated read published" SELECT policy.

-- ---------------------------------------------------------------------------
-- 3) hr_form_issuances — append-only ledger of every issued document,
--    the per-employee usage history the module's log viewer reads.
--    (No UPDATE/DELETE policies on purpose.)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hr_form_issuances (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid        NOT NULL REFERENCES public.hr_form_submissions(id) ON DELETE CASCADE,
  template_id     uuid        NOT NULL REFERENCES public.hr_form_templates(id),
  template_title  text        NOT NULL,
  employee_id     uuid        REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_name   text,
  issued_by       uuid        NOT NULL,
  issued_by_email text,
  formats         text[]      NOT NULL DEFAULT '{}',
  file_urls       jsonb       NOT NULL DEFAULT '{}',
  issued_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_form_issuances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read hr_form_issuances"
  ON public.hr_form_issuances
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin insert hr_form_issuances"
  ON public.hr_form_issuances
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Requesters can see issuance records of their own submissions.
CREATE POLICY "Requester read own hr_form_issuances"
  ON public.hr_form_issuances
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.hr_form_submissions s
    WHERE s.id = submission_id AND s.requested_by = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_hr_form_issuances_employee
  ON public.hr_form_issuances (employee_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_form_issuances_template
  ON public.hr_form_issuances (template_id, issued_at DESC);

NOTIFY pgrst, 'reload schema';
