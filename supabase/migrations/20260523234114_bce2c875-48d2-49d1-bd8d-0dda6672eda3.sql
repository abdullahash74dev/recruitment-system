-- 1) Bilingual value normalization
CREATE TABLE IF NOT EXISTS public.value_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name TEXT NOT NULL,                  -- e.g. 'education_level','nationality','city','desired_position'
  canonical_ar TEXT NOT NULL,
  canonical_en TEXT,
  synonyms TEXT[] NOT NULL DEFAULT '{}',     -- raw spellings to match (lowercased + trimmed)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (field_name, canonical_ar)
);
CREATE INDEX IF NOT EXISTS idx_value_synonyms_field ON public.value_synonyms(field_name);

ALTER TABLE public.value_synonyms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR view synonyms" ON public.value_synonyms FOR SELECT TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin insert synonyms" ON public.value_synonyms FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin update synonyms" ON public.value_synonyms FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin delete synonyms" ON public.value_synonyms FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_value_synonyms_updated_at BEFORE UPDATE ON public.value_synonyms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Report templates (custom builder)
CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL DEFAULT 'applicants',   -- 'applicants' | 'recruitment' | 'jobs'
  config JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { fields:[], filters:{}, group_by:[], ai_insights:bool, format:'excel'|'pdf' }
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin sel report_templates" ON public.report_templates FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin ins report_templates" ON public.report_templates FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin upd report_templates" ON public.report_templates FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin del report_templates" ON public.report_templates FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_report_templates_updated_at BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Add template_id link from scheduled_reports to report_templates (optional)
ALTER TABLE public.scheduled_reports ADD COLUMN IF NOT EXISTS template_id UUID;
ALTER TABLE public.report_runs ADD COLUMN IF NOT EXISTS template_id UUID;
ALTER TABLE public.report_runs ADD COLUMN IF NOT EXISTS insights_summary TEXT;

-- 4) Seed common education / city / nationality synonyms (idempotent)
INSERT INTO public.value_synonyms (field_name, canonical_ar, canonical_en, synonyms) VALUES
  ('education_level','بكالوريوس','Bachelor', ARRAY['بكالوريوس','بكالريوس','bachelor','bachelors','bsc','b.sc','b.a','ba','bs']),
  ('education_level','ماجستير','Master',     ARRAY['ماجستير','ماستر','master','masters','msc','m.sc','ma']),
  ('education_level','دكتوراه','PhD',         ARRAY['دكتوراه','دكتوراة','phd','ph.d','doctorate']),
  ('education_level','دبلوم','Diploma',       ARRAY['دبلوم','diploma','dip']),
  ('education_level','ثانوية','High School',  ARRAY['ثانوية','ثانوي','ثانوية عامة','high school','highschool','secondary']),
  ('city','الرياض','Riyadh',                  ARRAY['الرياض','رياض','riyadh','riyad','ar-riyadh']),
  ('city','جدة','Jeddah',                     ARRAY['جدة','جده','jeddah','jiddah','jedda']),
  ('city','الدمام','Dammam',                  ARRAY['الدمام','دمام','dammam']),
  ('city','مكة','Makkah',                     ARRAY['مكة','مكه','mecca','makkah']),
  ('city','المدينة','Madinah',                 ARRAY['المدينة','المدينه','المدينة المنورة','madinah','medina']),
  ('nationality','سعودي','Saudi',             ARRAY['سعودي','سعودية','saudi','ksa']),
  ('nationality','مصري','Egyptian',           ARRAY['مصري','مصرية','egyptian','egypt']),
  ('nationality','يمني','Yemeni',             ARRAY['يمني','يمنية','yemeni','yemen']),
  ('nationality','سوداني','Sudanese',         ARRAY['سوداني','سودانية','sudanese','sudan']),
  ('nationality','هندي','Indian',             ARRAY['هندي','هندية','indian','india']),
  ('nationality','باكستاني','Pakistani',       ARRAY['باكستاني','باكستانية','pakistani','pakistan']),
  ('nationality','فلبيني','Filipino',          ARRAY['فلبيني','فلبينية','filipino','philippines'])
ON CONFLICT (field_name, canonical_ar) DO NOTHING;