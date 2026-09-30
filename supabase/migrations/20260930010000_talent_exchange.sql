-- Talent Redeployment Exchange ("سوق إعادة توظيف الكفاءات"): lets a client
-- organization list an employee they're releasing (for any reason they
-- choose to disclose) so another client organization can discover and hire
-- them instead of them going unemployed -- a three-way win (employee,
-- releasing company, hiring company). Reuses the exact credit wallet
-- (client_organizations.credits_remaining) and reveal-after-payment pattern
-- already used for candidate search, so hiring a released talent costs the
-- same one credit a candidate reveal does.
--
-- The employee's real identity is NEVER shared without their own direct,
-- verifiable consent -- not just the releasing company's say-so. A
-- single-use token link (mirroring executive_share_links) is emailed
-- straight to the employee; nothing becomes visible to any other company
-- until they click confirm themselves.

CREATE TABLE public.talent_exchange_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  employee_full_name text NOT NULL,
  employee_contact_email text NOT NULL,
  employee_contact_phone text,
  position_title text NOT NULL,
  job_level text,
  current_salary numeric,
  current_work_location text,
  release_reason_category text NOT NULL DEFAULT 'other'
    CHECK (release_reason_category IN ('cost_reduction', 'restructuring', 'contract_end', 'relocation', 'other')),
  release_reason_note text,
  -- draft: releasing company is still filling it in, not sent yet.
  -- pending_consent: consent link sent, awaiting the employee's own decision.
  -- active: employee confirmed -- now discoverable (anonymized) by other orgs.
  -- withdrawn: releasing company cancelled it, or the employee declined.
  -- expired: the consent link's window passed with no response.
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_consent', 'active', 'withdrawn', 'expired')),
  consent_token text UNIQUE,
  consent_token_expires_at timestamptz,
  consent_status text NOT NULL DEFAULT 'pending' CHECK (consent_status IN ('pending', 'confirmed', 'declined')),
  consent_confirmed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX talent_exchange_listings_org_idx ON public.talent_exchange_listings (client_organization_id, created_at DESC);
CREATE INDEX talent_exchange_listings_active_idx ON public.talent_exchange_listings (status) WHERE status = 'active';

-- One reveal per (listing, hiring org) -- mirrors candidate_reveals.
CREATE TABLE public.talent_exchange_reveals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.talent_exchange_listings(id) ON DELETE CASCADE,
  client_organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  revealed_by uuid,
  revealed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, client_organization_id)
);

CREATE INDEX talent_exchange_reveals_org_idx ON public.talent_exchange_reveals (client_organization_id);

ALTER TABLE public.talent_exchange_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_exchange_reveals ENABLE ROW LEVEL SECURITY;

-- A releasing company fully manages its own listings (create the draft,
-- edit before consent is sent, withdraw at any time). It can never see raw
-- rows belonging to another org -- only through the anonymized view below.
CREATE POLICY "Clients manage own talent_exchange_listings" ON public.talent_exchange_listings
  FOR ALL TO authenticated
  USING (client_organization_id = get_my_client_organization_id())
  WITH CHECK (client_organization_id = get_my_client_organization_id());

CREATE POLICY "Admin manage all talent_exchange_listings" ON public.talent_exchange_listings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Reveals are only ever written by the reveal-talent-exchange-listing edge
-- function (service role, so it can atomically deduct a credit) -- no
-- client-side INSERT policy. A hiring org can read its own reveal history.
CREATE POLICY "Clients view own talent_exchange_reveals" ON public.talent_exchange_reveals
  FOR SELECT TO authenticated
  USING (client_organization_id = get_my_client_organization_id());

CREATE POLICY "Admin manage all talent_exchange_reveals" ON public.talent_exchange_reveals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Anonymized browse view: every OTHER company only ever sees this -- never
-- the base table's identity columns -- and only rows that are both active
-- and employee-confirmed. A company's own listings are managed through the
-- base table policy above instead, so this view never needs to reveal
-- who's releasing whom.
CREATE VIEW public.talent_exchange_browse AS
SELECT
  l.id,
  l.position_title,
  l.job_level,
  l.current_salary,
  l.current_work_location,
  l.release_reason_category,
  l.release_reason_note,
  l.created_at,
  EXISTS (
    SELECT 1 FROM public.talent_exchange_reveals r
    WHERE r.listing_id = l.id AND r.client_organization_id = get_my_client_organization_id()
  ) AS is_revealed_by_me
FROM public.talent_exchange_listings l
WHERE l.status = 'active' AND l.consent_status = 'confirmed';

GRANT SELECT ON public.talent_exchange_browse TO authenticated;

NOTIFY pgrst, 'reload schema';
