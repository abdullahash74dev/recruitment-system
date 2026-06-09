
-- Custom questions table
CREATE TABLE public.custom_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_ar text NOT NULL,
  question_en text,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'select', 'textarea')),
  options_ar text[] DEFAULT '{}',
  options_en text[] DEFAULT '{}',
  is_required boolean NOT NULL DEFAULT false,
  step_number integer NOT NULL DEFAULT 4,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can view custom questions" ON public.custom_questions FOR SELECT TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "Public can view active questions" ON public.custom_questions FOR SELECT TO public USING (is_active = true);
CREATE POLICY "HR can create custom questions" ON public.custom_questions FOR INSERT TO authenticated WITH CHECK (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR can update custom questions" ON public.custom_questions FOR UPDATE TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR can delete custom questions" ON public.custom_questions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_custom_questions_updated_at BEFORE UPDATE ON public.custom_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Custom answers table
CREATE TABLE public.custom_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.custom_questions(id) ON DELETE CASCADE,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit answers" ON public.custom_answers FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "HR can view answers" ON public.custom_answers FOR SELECT TO authenticated USING (is_admin_or_hr(auth.uid()));
