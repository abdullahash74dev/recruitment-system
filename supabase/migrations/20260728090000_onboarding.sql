-- Post-hire onboarding: reusable templates of tasks, and per-employee checklists
-- instantiated from a template when someone is hired.
CREATE TABLE IF NOT EXISTS public.onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_tasks_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  task_description text,
  due_days_after_start int NOT NULL DEFAULT 1,
  assigned_to_role text DEFAULT 'hr',
  order_index int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.onboarding_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid REFERENCES public.applicants(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.onboarding_templates(id) ON DELETE SET NULL,
  employee_name text,
  start_date date,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.onboarding_checklists(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  task_description text,
  due_date date,
  assigned_to text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','skipped')),
  completed_at timestamptz,
  notes text,
  order_index int NOT NULL DEFAULT 0
);

ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tasks_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage onboarding_templates" ON public.onboarding_templates
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage onboarding_tasks_template" ON public.onboarding_tasks_template
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage onboarding_checklists" ON public.onboarding_checklists
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage onboarding_checklist_items" ON public.onboarding_checklist_items
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_onboarding_items_checklist ON public.onboarding_checklist_items (checklist_id, order_index);
CREATE INDEX IF NOT EXISTS idx_onboarding_checklists_applicant ON public.onboarding_checklists (applicant_id);

NOTIFY pgrst, 'reload schema';
