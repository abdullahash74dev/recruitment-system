-- Job categories table
CREATE TABLE public.job_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.job_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_categories TO authenticated;
GRANT ALL ON public.job_categories TO service_role;

ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view job categories" ON public.job_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage job categories" ON public.job_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_job_categories_updated_at BEFORE UPDATE ON public.job_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add category column to recruitment_job_titles
ALTER TABLE public.recruitment_job_titles ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.job_categories(id) ON DELETE SET NULL;

-- Job title categorization map (works for any title text, including applicants.desired_position)
CREATE TABLE public.job_title_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_normalized TEXT NOT NULL UNIQUE,
  title_display TEXT NOT NULL,
  category_id UUID REFERENCES public.job_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.job_title_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_title_categories TO authenticated;
GRANT ALL ON public.job_title_categories TO service_role;

ALTER TABLE public.job_title_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view title categories" ON public.job_title_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage title categories" ON public.job_title_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_job_title_categories_updated_at BEFORE UPDATE ON public.job_title_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed common categories
INSERT INTO public.job_categories (name_ar, name_en, color, sort_order) VALUES
  ('هندسية', 'Engineering', '#3b82f6', 1),
  ('فنية', 'Technical', '#10b981', 2),
  ('إشرافية / إدارية', 'Supervisory / Admin', '#f59e0b', 3),
  ('خدمات ونظافة', 'Services & Cleaning', '#8b5cf6', 4),
  ('أمن وسلامة', 'Security & Safety', '#ef4444', 5),
  ('مالية ومحاسبة', 'Finance & Accounting', '#06b6d4', 6),
  ('تقنية معلومات', 'IT', '#6366f1', 7),
  ('موارد بشرية', 'HR', '#ec4899', 8),
  ('أخرى', 'Other', '#6b7280', 99);