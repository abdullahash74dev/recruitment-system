-- Job board publishing: which external job boards the company has an account
-- on, and the individual listings pushed to them.
--
-- NOTE ON AUTOMATION: nothing here calls a job board API. LinkedIn, Indeed,
-- Bayt, GulfTalent and friends all require a per-board API key / partner token
-- that must never reach the browser, so real posting has to run from an edge
-- function holding those secrets. Until that is wired up this module is the
-- system of record: recruiters publish by hand on each board and register the
-- resulting URL here so reach, views and applicant counts stay in one place.

-- One row per board the company can publish to. Seeded once with the supported
-- boards; UNIQUE (board) keeps that list canonical so the UI can render a fixed
-- grid and upsert against a known key.
CREATE TABLE IF NOT EXISTS public.job_board_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text NOT NULL
    CHECK (board IN ('linkedin','indeed','bayt','naukrigulf','gulftalent','tanqeeb','google_jobs','custom')),
  display_name text,
  -- Company page slug, employer id, or login e-mail used on that board —
  -- whatever identifies *our* account there. Never a password or API key:
  -- credentials belong in edge-function secrets.
  account_identifier text,
  -- Recruiters flip this on once the account exists; only active boards are
  -- offered as publishing targets.
  is_active boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board)
);

-- One row per (job, board) listing.
CREATE TABLE IF NOT EXISTS public.job_board_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Soft link to public.job_postings. Intentionally not a foreign key: the
  -- listing may outlive the internal posting (an expired board listing is still
  -- worth reporting on), and jobs can be published ad-hoc.
  job_posting_id uuid,
  -- Denormalised title so the row stays readable after the posting is edited
  -- or removed — the board is showing whatever text was live at publish time.
  job_title text NOT NULL,
  board text NOT NULL
    CHECK (board IN ('linkedin','indeed','bayt','naukrigulf','gulftalent','tanqeeb','google_jobs','custom')),
  -- Public listing URL on the board, and the board's own listing id when known
  -- (needed later to refresh/expire the listing through its API).
  external_url text,
  external_id text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','queued','published','failed','expired','removed')),
  published_at timestamptz,
  expires_at timestamptz,
  -- Manually reported from each board's dashboard until API sync exists.
  view_count int DEFAULT 0,
  applicant_count int DEFAULT 0,
  -- Why a 'failed' row failed (rejected by the board, quota exhausted, ...).
  error_detail text,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_board_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_board_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage job_board_accounts" ON public.job_board_accounts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage job_board_publications" ON public.job_board_publications
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_job_board_accounts_created ON public.job_board_accounts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_board_publications_created ON public.job_board_publications (created_at DESC);
-- Status/board filters drive the publications table and the stats cards.
CREATE INDEX IF NOT EXISTS idx_job_board_publications_status ON public.job_board_publications (status);
CREATE INDEX IF NOT EXISTS idx_job_board_publications_board ON public.job_board_publications (board);
CREATE INDEX IF NOT EXISTS idx_job_board_publications_job ON public.job_board_publications (job_posting_id);

-- Seed the supported boards, all inactive until someone confirms the account.
-- ON CONFLICT DO NOTHING keeps re-runs idempotent and never clobbers an
-- identifier a recruiter has already filled in.
INSERT INTO public.job_board_accounts (board, display_name, is_active) VALUES
  ('linkedin',    'LinkedIn',     false),
  ('indeed',      'Indeed',       false),
  ('bayt',        'Bayt.com',     false),
  ('naukrigulf',  'Naukrigulf',   false),
  ('gulftalent',  'GulfTalent',   false),
  ('tanqeeb',     'Tanqeeb',      false),
  ('google_jobs', 'Google Jobs',  false)
ON CONFLICT (board) DO NOTHING;

NOTIFY pgrst, 'reload schema';
