-- Phone screening: a timed, structured phone-call evaluation tool usable
-- both by internal HR (client_organization_id IS NULL rows) and by client
-- companies (their own client_organization_id), on any candidate they can
-- already see. The call itself happens on the recruiter's own phone/WhatsApp
-- -- this system only manages the timer, the question checklist, and the
-- recorded outcome.
--
-- Timing model: a call should last min_duration_seconds..initial_max_duration_seconds
-- (default 1-3 min) to judge fit. If the candidate is clearly a strong match,
-- the recruiter marks every question "passed", which auto-extends the call's
-- cap to extended_max_duration_seconds (default 10 min) so the conversation
-- can continue without the timer cutting it short.

-- =========================================================================
-- 1) Settings: one row per scope. client_organization_id NULL = the single
--    internal/admin default; non-NULL = one row per client org, fully
--    independent (a client customizes without touching the admin's setup).
-- =========================================================================
CREATE TABLE public.phone_screening_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_organization_id uuid REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  min_duration_seconds int NOT NULL DEFAULT 60 CHECK (min_duration_seconds > 0),
  initial_max_duration_seconds int NOT NULL DEFAULT 180 CHECK (initial_max_duration_seconds >= min_duration_seconds),
  extended_max_duration_seconds int NOT NULL DEFAULT 600 CHECK (extended_max_duration_seconds >= initial_max_duration_seconds),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- At most one internal row (client_organization_id IS NULL)...
CREATE UNIQUE INDEX phone_screening_settings_internal_uq
  ON public.phone_screening_settings ((true))
  WHERE client_organization_id IS NULL;
-- ...and at most one row per client org.
CREATE UNIQUE INDEX phone_screening_settings_org_uq
  ON public.phone_screening_settings (client_organization_id)
  WHERE client_organization_id IS NOT NULL;

INSERT INTO public.phone_screening_settings (client_organization_id) VALUES (NULL);

-- =========================================================================
-- 2) Question bank: same NULL-scope convention as settings.
-- =========================================================================
CREATE TABLE public.phone_screening_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_organization_id uuid REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  question_ar text NOT NULL,
  question_en text,
  expected_answer_ar text,
  expected_answer_en text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX phone_screening_questions_scope_idx
  ON public.phone_screening_questions (client_organization_id, display_order);

INSERT INTO public.phone_screening_questions
  (client_organization_id, question_ar, question_en, expected_answer_ar, expected_answer_en, display_order)
VALUES
  (NULL, 'عرّفنا عن نفسك وخبرتك بإيجاز', 'Briefly introduce yourself and your experience',
   'يتحدث بثقة ووضوح عن خبرته ذات الصلة بالوظيفة خلال دقيقة تقريباً', 'Speaks confidently and clearly about job-relevant experience in about a minute', 1),
  (NULL, 'ليش تقدمت لهذي الوظيفة تحديداً؟', 'Why did you apply for this specific position?',
   'إجابة مرتبطة فعلياً بمتطلبات الوظيفة ومساره المهني، مو إجابة عامة', 'A specific answer tied to the role and their career path, not a generic one', 2),
  (NULL, 'وش راتبك المتوقع؟', 'What is your expected salary?',
   'رقم واقعي يتوافق مع نطاق الوظيفة وخبرته', 'A realistic figure aligned with the role''s range and their experience', 3),
  (NULL, 'متى تقدر تباشر لو تم قبولك؟', 'When could you start if accepted?',
   'فترة إشعار معقولة (عادة أسبوعين إلى شهر)', 'A reasonable notice period (typically two weeks to a month)', 4),
  (NULL, 'عندك أي استفسار أو سؤال؟', 'Do you have any questions for us?',
   'يدل على اهتمام حقيقي ومطّلع بالفرصة', 'Shows genuine, informed interest in the opportunity', 5);

-- =========================================================================
-- 3) Screenings: one row per phone call/evaluation session.
-- =========================================================================
CREATE TABLE public.phone_screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  client_organization_id uuid REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  performed_by uuid NOT NULL,
  performed_by_name text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int,
  was_extended boolean NOT NULL DEFAULT false,
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('passed', 'rejected', 'pending')),
  rejection_reason_id uuid REFERENCES public.rejection_reasons(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX phone_screenings_applicant_idx ON public.phone_screenings (applicant_id, created_at DESC);
CREATE INDEX phone_screenings_org_idx ON public.phone_screenings (client_organization_id, created_at DESC);

-- =========================================================================
-- 4) Per-question answers within a screening. question_snapshot preserves
--    the question's wording even if the question bank entry is later
--    edited or deleted, so historical screenings stay readable.
-- =========================================================================
CREATE TABLE public.phone_screening_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_id uuid NOT NULL REFERENCES public.phone_screenings(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.phone_screening_questions(id) ON DELETE SET NULL,
  question_snapshot text NOT NULL,
  result text NOT NULL DEFAULT 'skipped' CHECK (result IN ('passed', 'failed', 'skipped'))
);

CREATE INDEX phone_screening_answers_screening_idx ON public.phone_screening_answers (screening_id);

-- =========================================================================
-- RLS
-- =========================================================================
ALTER TABLE public.phone_screening_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_screening_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_screening_answers ENABLE ROW LEVEL SECURITY;

-- Settings: HR manage the internal row; admins manage every row (oversight);
-- a client org's users manage only their own org's row.
CREATE POLICY "HR manage internal phone_screening_settings" ON public.phone_screening_settings
  FOR ALL TO authenticated
  USING (client_organization_id IS NULL AND is_admin_or_hr(auth.uid()))
  WITH CHECK (client_organization_id IS NULL AND is_admin_or_hr(auth.uid()));

CREATE POLICY "Admin manage all phone_screening_settings" ON public.phone_screening_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients manage own phone_screening_settings" ON public.phone_screening_settings
  FOR ALL TO authenticated
  USING (client_organization_id = get_my_client_organization_id())
  WITH CHECK (client_organization_id = get_my_client_organization_id());

-- Questions: same three-way split.
CREATE POLICY "HR manage internal phone_screening_questions" ON public.phone_screening_questions
  FOR ALL TO authenticated
  USING (client_organization_id IS NULL AND is_admin_or_hr(auth.uid()))
  WITH CHECK (client_organization_id IS NULL AND is_admin_or_hr(auth.uid()));

CREATE POLICY "Admin manage all phone_screening_questions" ON public.phone_screening_questions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients manage own phone_screening_questions" ON public.phone_screening_questions
  FOR ALL TO authenticated
  USING (client_organization_id = get_my_client_organization_id())
  WITH CHECK (client_organization_id = get_my_client_organization_id());

-- Screenings: a client can only ever create/see screenings for candidates
-- their own org has actually revealed (paid for) -- never an unrevealed one.
CREATE POLICY "HR manage internal phone_screenings" ON public.phone_screenings
  FOR ALL TO authenticated
  USING (client_organization_id IS NULL AND is_admin_or_hr(auth.uid()))
  WITH CHECK (client_organization_id IS NULL AND is_admin_or_hr(auth.uid()));

CREATE POLICY "Admin manage all phone_screenings" ON public.phone_screenings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients manage own phone_screenings" ON public.phone_screenings
  FOR ALL TO authenticated
  USING (client_organization_id = get_my_client_organization_id())
  WITH CHECK (
    client_organization_id = get_my_client_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.candidate_reveals cr
      WHERE cr.client_organization_id = phone_screenings.client_organization_id
        AND cr.applicant_id = phone_screenings.applicant_id
    )
  );

-- Answers: scoped through their parent screening row.
CREATE POLICY "HR manage internal phone_screening_answers" ON public.phone_screening_answers
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.phone_screenings s
    WHERE s.id = phone_screening_answers.screening_id AND s.client_organization_id IS NULL
  ) AND is_admin_or_hr(auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.phone_screenings s
    WHERE s.id = phone_screening_answers.screening_id AND s.client_organization_id IS NULL
  ) AND is_admin_or_hr(auth.uid()));

CREATE POLICY "Admin manage all phone_screening_answers" ON public.phone_screening_answers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients manage own phone_screening_answers" ON public.phone_screening_answers
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.phone_screenings s
    WHERE s.id = phone_screening_answers.screening_id
      AND s.client_organization_id = get_my_client_organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.phone_screenings s
    WHERE s.id = phone_screening_answers.screening_id
      AND s.client_organization_id = get_my_client_organization_id()
  ));

NOTIFY pgrst, 'reload schema';
