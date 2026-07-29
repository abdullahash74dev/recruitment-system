-- Recruitment budget per department/year, plus individual hiring cost entries
-- that roll up into cost-per-hire.
CREATE TABLE IF NOT EXISTS public.recruitment_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  fiscal_year int NOT NULL,
  total_budget numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department, fiscal_year)
);

CREATE TABLE IF NOT EXISTS public.hiring_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid REFERENCES public.applicants(id) ON DELETE SET NULL,
  department text,
  cost_type text NOT NULL CHECK (cost_type IN ('job_board','agency','referral_bonus','interview','assessment','onboarding','relocation','other')),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  description text,
  cost_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recruitment_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage recruitment_budgets" ON public.recruitment_budgets
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage hiring_costs" ON public.hiring_costs
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_hiring_costs_date ON public.hiring_costs (cost_date DESC);
CREATE INDEX IF NOT EXISTS idx_hiring_costs_department ON public.hiring_costs (department);

NOTIFY pgrst, 'reload schema';
