-- Talent Pool: passive candidate repository for sourcing and relationship management.
-- Stores individuals who have not formally applied but are tracked for future opportunities.
-- Admins have full CRUD access; all authenticated users may read.

CREATE TABLE IF NOT EXISTS public.talent_pool (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name             text        NOT NULL,
  email                 text,
  phone                 text,
  linkedin              text,
  current_company       text,
  current_title         text,
  years_experience      text,
  skills                text,
  desired_salary_min    numeric,
  desired_salary_max    numeric,
  preferred_locations   text,
  availability          text        DEFAULT 'not_looking'
                                    CHECK (availability IN ('immediate','1_month','3_months','6_months','not_looking')),
  notes                 text,
  source                text,
  tags                  text,
  last_contacted_at     timestamptz,
  next_followup_at      timestamptz,
  rating                int         CHECK (rating BETWEEN 1 AND 5),
  added_by              uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.talent_pool ENABLE ROW LEVEL SECURITY;

-- Admins have full access.
CREATE POLICY "Admin manage talent_pool"
  ON public.talent_pool
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can read talent pool entries.
CREATE POLICY "Authenticated read talent_pool"
  ON public.talent_pool
  FOR SELECT
  TO authenticated
  USING (true);

-- Keep updated_at current on every row mutation.
CREATE OR REPLACE FUNCTION public.talent_pool_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_talent_pool_updated_at
  BEFORE UPDATE ON public.talent_pool
  FOR EACH ROW EXECUTE FUNCTION public.talent_pool_set_updated_at();

-- Performance indexes.
CREATE INDEX IF NOT EXISTS idx_talent_pool_availability
  ON public.talent_pool (availability, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_talent_pool_next_followup
  ON public.talent_pool (next_followup_at)
  WHERE next_followup_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_talent_pool_created
  ON public.talent_pool (created_at DESC);

NOTIFY pgrst, 'reload schema';
