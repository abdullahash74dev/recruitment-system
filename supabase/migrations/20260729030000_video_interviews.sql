-- Video interview integration: one settings row describing which conferencing
-- provider the team uses, plus the scheduled video sessions themselves.
--
-- Meeting links are stored as plain text. Creating a *real* pre-booked meeting
-- (fixed Meet code, Zoom meeting id + passcode, Teams join URL) needs a
-- server-side OAuth exchange with the provider, so until those credentials
-- exist the app writes a provider "start a meeting" link that recruiters can
-- open or overwrite by hand.
CREATE TABLE IF NOT EXISTS public.video_meeting_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'google_meet'
    CHECK (provider IN ('google_meet','zoom','teams','custom')),
  default_duration_minutes int DEFAULT 45,
  -- When false, the scheduler refuses to invent a link and the recruiter must
  -- paste one created in the provider's own UI.
  auto_generate_link boolean DEFAULT true,
  -- Only used by provider='custom'. May contain an {id} token, replaced with
  -- the generated meeting id (e.g. https://meet.example.com/{id}).
  custom_link_pattern text,
  is_active boolean DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.video_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Optional back-reference to public.interviews. Intentionally not a foreign
  -- key: a video session may be booked ad-hoc before an interview row exists,
  -- and must survive the interview being rescheduled away.
  interview_id uuid,
  applicant_id uuid REFERENCES public.applicants(id) ON DELETE CASCADE,
  -- Denormalised name so the row stays readable for ad-hoc candidates with no
  -- applicants row yet.
  applicant_name text,
  provider text NOT NULL DEFAULT 'google_meet'
    CHECK (provider IN ('google_meet','zoom','teams','custom')),
  meeting_link text NOT NULL,
  meeting_id text,
  passcode text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int DEFAULT 45,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','live','completed','cancelled','no_show')),
  recording_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_meeting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage video_meeting_settings" ON public.video_meeting_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage video_sessions" ON public.video_sessions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_video_meeting_settings_created ON public.video_meeting_settings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_sessions_created ON public.video_sessions (created_at DESC);
-- Drives the "upcoming sessions" board, which reads future rows in time order.
CREATE INDEX IF NOT EXISTS idx_video_sessions_scheduled ON public.video_sessions (scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_sessions_status ON public.video_sessions (status);
CREATE INDEX IF NOT EXISTS idx_video_sessions_applicant ON public.video_sessions (applicant_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_interview ON public.video_sessions (interview_id);

NOTIFY pgrst, 'reload schema';
