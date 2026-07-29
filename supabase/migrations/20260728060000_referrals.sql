-- Employee referral program: staff refer candidates and earn a reward once the
-- referral is hired. Referrers see only their own rows; admins see everything.
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid,
  referrer_email text,
  referrer_name text,
  candidate_name text NOT NULL,
  candidate_email text,
  candidate_phone text,
  position_applied text,
  relationship text,
  notes text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','reviewing','interviewing','hired','rejected','withdrawn')),
  reward_amount numeric NOT NULL DEFAULT 0,
  reward_currency text NOT NULL DEFAULT 'SAR',
  reward_paid boolean NOT NULL DEFAULT false,
  reward_paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage referrals" ON public.referrals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own referrals" ON public.referrals
  FOR SELECT TO authenticated USING (referrer_id = auth.uid());

CREATE POLICY "Users create own referrals" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (referrer_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_id);

NOTIFY pgrst, 'reload schema';
