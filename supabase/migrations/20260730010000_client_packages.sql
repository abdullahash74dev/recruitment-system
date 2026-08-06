-- Client-rental package system: shared-pool applicant search for paying client organizations.
-- IMPORTANT: this must be the very first statement in the file and nothing later in this
-- file references 'client' as an app_role literal (see notes below on get_my_client_organization_id).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- =========================================================================
-- Tables
-- =========================================================================

CREATE TABLE public.subscription_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description_ar text,
  description_en text,
  duration_months int NOT NULL DEFAULT 3,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  credits_included int NOT NULL DEFAULT 50,
  max_users int NOT NULL DEFAULT 3,
  features jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.client_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  package_id uuid REFERENCES public.subscription_packages(id) ON DELETE SET NULL,
  credits_remaining int NOT NULL DEFAULT 0,
  subscription_status text NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'expired', 'suspended')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  full_name text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE public.candidate_reveals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  revealed_by uuid,
  revealed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_organization_id, applicant_id)
);

-- =========================================================================
-- Helper function
--
-- Authorization for the 'client' role is driven by membership in
-- client_users (an active row) rather than by checking the app_role enum
-- literal 'client' directly, so this file never needs to reference 'client'
-- as an app_role literal after the ALTER TYPE statement above.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_my_client_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cu.client_organization_id
  FROM public.client_users cu
  WHERE cu.user_id = auth.uid()
    AND cu.is_active = true
  LIMIT 1;
$$;

-- =========================================================================
-- Row Level Security
--
-- Client-role users NEVER get an RLS policy on public.applicants. All
-- client-facing applicant reads (with phone/email masking and reveal-credit
-- accounting) must go through edge functions using the service-role key.
-- =========================================================================

ALTER TABLE public.subscription_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_reveals ENABLE ROW LEVEL SECURITY;

-- subscription_packages: admin full access; clients may view active packages only
CREATE POLICY "Admins manage subscription packages"
  ON public.subscription_packages
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view active packages"
  ON public.subscription_packages
  FOR SELECT
  USING (
    is_active = true
    AND public.get_my_client_organization_id() IS NOT NULL
  );

-- client_organizations: admin full access; a client user may view only their own org
CREATE POLICY "Admins manage client organizations"
  ON public.client_organizations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view own organization"
  ON public.client_organizations
  FOR SELECT
  USING (id = public.get_my_client_organization_id());

-- client_users: admin full access; a client user may view their own row and
-- other members of their own organization (read-only, admin manages membership)
CREATE POLICY "Admins manage client users"
  ON public.client_users
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view own org members"
  ON public.client_users
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR client_organization_id = public.get_my_client_organization_id()
  );

-- candidate_reveals: admin full access (analytics); a client user may view
-- only their own org's reveals. No client INSERT/UPDATE/DELETE policy at
-- all -- reveals must only ever be written by the reveal-candidate edge
-- function via the service-role key, which is what enforces credit
-- deduction and prevents double-charging for the same applicant.
CREATE POLICY "Admins manage candidate reveals"
  ON public.candidate_reveals
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view own org reveals"
  ON public.candidate_reveals
  FOR SELECT
  USING (client_organization_id = public.get_my_client_organization_id());

-- =========================================================================
-- Indexes
-- =========================================================================

CREATE INDEX idx_client_organizations_status ON public.client_organizations(subscription_status);
CREATE INDEX idx_client_users_org ON public.client_users(client_organization_id);
CREATE INDEX idx_candidate_reveals_org ON public.candidate_reveals(client_organization_id);

NOTIFY pgrst, 'reload schema';
