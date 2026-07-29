-- Offer Letters: formal job offer documents sent to accepted candidates.
-- Tracks the full draft → sent → accepted/rejected/expired lifecycle with
-- timestamped transitions. Only admins can manage rows (RLS).

CREATE TABLE IF NOT EXISTS public.offer_letters (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id     uuid        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  position_title   text        NOT NULL,
  department       text,
  salary_offered   numeric,
  salary_currency  text        NOT NULL DEFAULT 'SAR',
  start_date       date,
  contract_type    text        NOT NULL DEFAULT 'permanent'
                               CHECK (contract_type IN ('permanent', 'contract', 'part_time')),
  benefits         text,
  additional_terms text,
  status           text        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  sent_at          timestamptz,
  responded_at     timestamptz,
  expires_at       timestamptz,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_letters ENABLE ROW LEVEL SECURITY;

-- Admins have full access to all offer letters.
CREATE POLICY "Admin manage offer_letters"
  ON public.offer_letters
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Performance indexes.
CREATE INDEX IF NOT EXISTS idx_offer_letters_applicant
  ON public.offer_letters (applicant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_offer_letters_status
  ON public.offer_letters (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_offer_letters_created
  ON public.offer_letters (created_at DESC);

NOTIFY pgrst, 'reload schema';
