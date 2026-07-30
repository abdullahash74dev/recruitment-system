-- Candidate assessments / tests: a reusable bank of assessments with their
-- questions, per-candidate assignments of those assessments, and the answers
-- captured (or graded) for each assignment.
CREATE TABLE IF NOT EXISTS public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  duration_minutes int DEFAULT 30,
  passing_score int DEFAULT 60,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'multiple_choice'
    CHECK (question_type IN ('multiple_choice','true_false','short_answer')),
  -- Newline/comma separated choices for multiple_choice questions.
  options text,
  correct_answer text,
  points int DEFAULT 1,
  order_index int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.assessment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  applicant_id uuid REFERENCES public.applicants(id) ON DELETE CASCADE,
  -- Denormalised name so the row stays readable for ad-hoc candidates that
  -- have no applicants row yet, and after an applicant is purged.
  applicant_name text,
  status text NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned','in_progress','completed','expired')),
  score int,
  max_score int,
  passed boolean,
  started_at timestamptz,
  completed_at timestamptz,
  due_date date,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assessment_assignments(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  answer_text text,
  is_correct boolean,
  points_awarded int DEFAULT 0
);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage assessments" ON public.assessments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage assessment_questions" ON public.assessment_questions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage assessment_assignments" ON public.assessment_assignments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage assessment_answers" ON public.assessment_answers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_assessments_created ON public.assessments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment ON public.assessment_questions (assessment_id, order_index);
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_created ON public.assessment_assignments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_assessment ON public.assessment_assignments (assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_applicant ON public.assessment_assignments (applicant_id);
CREATE INDEX IF NOT EXISTS idx_assessment_answers_assignment ON public.assessment_answers (assignment_id);

NOTIFY pgrst, 'reload schema';
