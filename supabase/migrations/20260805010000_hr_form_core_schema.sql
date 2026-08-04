-- HR Forms module: core schema.
-- Employee master data (the shared source that auto-fills every form),
-- versioned schema-driven form templates, and form submissions with the
-- full request → approve → issue lifecycle (Phase 1 only exercises 'draft';
-- the remaining states exist now so later phases need no schema change).

-- ---------------------------------------------------------------------------
-- 1) employees — canonical employee master record
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employees (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no         text        UNIQUE,
  full_name_en        text        NOT NULL,
  full_name_ar        text,
  national_id         text,
  passport_no         text,
  nationality         text,
  gender              text,
  birth_date          date,
  marital_status      text,
  phone               text,
  personal_email      text,
  work_email          text,
  department          text,
  job_title           text,
  manager_employee_id uuid        REFERENCES public.employees(id) ON DELETE SET NULL,
  employment_type     text        CHECK (employment_type IN ('permanent', 'contract', 'part_time', 'probation')),
  hire_date           date,
  end_of_service_date date,
  base_salary         numeric,
  housing_allowance   numeric,
  transport_allowance numeric,
  salary_currency     text        NOT NULL DEFAULT 'SAR',
  bank_name           text,
  bank_account_no     text,
  bank_iban           text,
  status              text        NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'on_leave', 'terminated', 'resigned')),
  source_applicant_id uuid        REFERENCES public.applicants(id) ON DELETE SET NULL,
  photo_url           text,
  -- Admin-defined custom employee fields (keyed by the same field-key
  -- namespace used in form template schemas) live here so a template field
  -- marked source='employee' can resolve to either a real column or extra->>key.
  extra               jsonb       NOT NULL DEFAULT '{}',
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage employees"
  ON public.employees
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Non-admin HR staff may read employee records (to pick an employee when
-- filling a form) but never modify master data. Fine-grained visibility is
-- additionally gated in the app by the 'hr_forms.view_employees' permission.
CREATE POLICY "HR read employees"
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (is_admin_or_hr(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_employees_employee_no ON public.employees (employee_no);
CREATE INDEX IF NOT EXISTS idx_employees_dept_status ON public.employees (department, status);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON public.employees (manager_employee_id);

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_employees
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- 2) hr_form_templates — versioned, schema-driven form definitions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hr_form_templates (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text        NOT NULL,
  title_en          text        NOT NULL,
  title_ar          text,
  category          text,
  doc_no            text,
  department_owner  text,
  version           integer     NOT NULL DEFAULT 1,
  revision_no       text,
  revision_date     date,
  -- Sections/fields definition consumed by the frontend template engine:
  -- { sections: [{ key, title_en, title_ar, fields: [{ key, type, source, ... }] }] }
  schema            jsonb       NOT NULL DEFAULT '{"sections": []}',
  status            text        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'published', 'archived')),
  is_system_seed    boolean     NOT NULL DEFAULT false,
  requires_approval boolean     NOT NULL DEFAULT true,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- A published template's schema is never mutated in place: a new revision
  -- is a new row with the same slug and a higher version (mirrors the paper
  -- forms' Rev No. / Rev Date document control).
  UNIQUE (slug, version)
);

ALTER TABLE public.hr_form_templates ENABLE ROW LEVEL SECURITY;

-- Only admins create or restructure templates.
CREATE POLICY "Admin manage hr_form_templates"
  ON public.hr_form_templates
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Any authenticated staff can see published templates (needed to fill them).
CREATE POLICY "Authenticated read published hr_form_templates"
  ON public.hr_form_templates
  FOR SELECT
  TO authenticated
  USING (status = 'published');

CREATE INDEX IF NOT EXISTS idx_hr_form_templates_slug ON public.hr_form_templates (slug, version DESC);
CREATE INDEX IF NOT EXISTS idx_hr_form_templates_status ON public.hr_form_templates (status);

CREATE TRIGGER update_hr_form_templates_updated_at
  BEFORE UPDATE ON public.hr_form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_hr_form_templates
  AFTER INSERT OR UPDATE OR DELETE ON public.hr_form_templates
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- 3) hr_form_submissions — one filled instance of a template
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hr_form_submissions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id          uuid        NOT NULL REFERENCES public.hr_form_templates(id),
  -- Nullable: some forms (e.g. Manpower Request) are not employee-scoped.
  employee_id          uuid        REFERENCES public.employees(id) ON DELETE SET NULL,
  data                 jsonb       NOT NULL DEFAULT '{}',
  status               text        NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'issued', 'cancelled')),
  requested_by         uuid        NOT NULL,
  requested_by_email   text,
  approver_id          uuid,
  submitted_at         timestamptz,
  decided_by           uuid,
  decided_by_email     text,
  decided_at           timestamptz,
  rejection_reason     text,
  issued_at            timestamptz,
  issued_by            uuid,
  issued_file_pdf_url  text,
  issued_file_docx_url text,
  issued_file_xlsx_url text,
  issued_file_png_url  text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage hr_form_submissions"
  ON public.hr_form_submissions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Requesters always see their own submissions (to track them through the
-- pipeline) and may edit them only while still editable.
CREATE POLICY "Requester read own hr_form_submissions"
  ON public.hr_form_submissions
  FOR SELECT
  TO authenticated
  USING (requested_by = auth.uid());

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
  );

CREATE POLICY "Requester update own editable hr_form_submissions"
  ON public.hr_form_submissions
  FOR UPDATE
  TO authenticated
  USING (requested_by = auth.uid() AND status IN ('draft', 'rejected'))
  WITH CHECK (requested_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_hr_form_submissions_status ON public.hr_form_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_form_submissions_employee ON public.hr_form_submissions (employee_id, template_id);
CREATE INDEX IF NOT EXISTS idx_hr_form_submissions_requester ON public.hr_form_submissions (requested_by);
CREATE INDEX IF NOT EXISTS idx_hr_form_submissions_approver ON public.hr_form_submissions (approver_id, status);

CREATE TRIGGER update_hr_form_submissions_updated_at
  BEFORE UPDATE ON public.hr_form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_hr_form_submissions
  AFTER INSERT OR UPDATE OR DELETE ON public.hr_form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- ---------------------------------------------------------------------------
-- 4) Storage bucket for generated/issued form documents
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-form-documents', 'hr-form-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin manage hr-form-documents"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'hr-form-documents' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'hr-form-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner read hr-form-documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'hr-form-documents' AND owner = auth.uid());

NOTIFY pgrst, 'reload schema';
