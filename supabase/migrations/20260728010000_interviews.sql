-- Interview scheduling: stores scheduled, completed, cancelled, and no-show
-- interviews for each applicant, linked to a profile as the interviewer.

CREATE TABLE IF NOT EXISTS public.interviews (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id     uuid        REFERENCES public.applicants(id)  ON DELETE CASCADE,
  interviewer_id   uuid        REFERENCES public.profiles(id)    ON DELETE SET NULL,
  scheduled_at     timestamptz NOT NULL,
  duration_minutes int         DEFAULT 60,
  location         text,
  meeting_link     text,
  type             text        NOT NULL DEFAULT 'in_person'
                                CHECK (type IN ('phone', 'video', 'in_person')),
  status           text        NOT NULL DEFAULT 'scheduled'
                                CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes            text,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- Admins have unrestricted access (required pattern)
CREATE POLICY "Admin manage interviews"
  ON public.interviews FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All HR roles can view interviews
CREATE POLICY "HR staff can view interviews"
  ON public.interviews FOR SELECT
  TO authenticated
  USING (public.is_admin_or_hr(auth.uid()));

-- HR staff can schedule new interviews
CREATE POLICY "HR staff can create interviews"
  ON public.interviews FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- HR staff can update interview status / details
CREATE POLICY "HR staff can update interviews"
  ON public.interviews FOR UPDATE
  TO authenticated
  USING  (public.is_admin_or_hr(auth.uid()))
  WITH CHECK (public.is_admin_or_hr(auth.uid()));

-- Only admins can delete interviews (covered by the admin ALL policy above)

CREATE INDEX IF NOT EXISTS idx_interviews_applicant_id   ON public.interviews (applicant_id);
CREATE INDEX IF NOT EXISTS idx_interviews_interviewer_id ON public.interviews (interviewer_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at   ON public.interviews (scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_interviews_status         ON public.interviews (status);

NOTIFY pgrst, 'reload schema';
