
-- Recruitment module enum
CREATE TYPE public.recruitment_status AS ENUM ('new','interviewed','selected','offer_accepted','hired','rejected');

-- Projects (recruitment-specific clients/projects)
CREATE TABLE public.recruitment_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Job titles per project (drives public board)
CREATE TABLE public.recruitment_job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.recruitment_projects(id) ON DELETE CASCADE,
  title_ar text NOT NULL,
  title_en text,
  requirements_ar text,
  requirements_en text,
  nationality_required text,
  location text DEFAULT 'الرياض، المملكة العربية السعودية',
  job_type text DEFAULT 'دوام كامل',
  salary_range text,
  target_headcount integer NOT NULL DEFAULT 1 CHECK (target_headcount >= 0),
  is_published_to_board boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  synced_job_posting_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rjt_project ON public.recruitment_job_titles(project_id);

-- Import batches
CREATE TABLE public.recruitment_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text,
  total_rows integer NOT NULL DEFAULT 0,
  inserted_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  imported_by uuid,
  imported_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Candidates
CREATE TABLE public.recruitment_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.recruitment_projects(id) ON DELETE RESTRICT,
  job_title_id uuid NOT NULL REFERENCES public.recruitment_job_titles(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  nationality text,
  phone text,
  email text,
  cv_url text,
  status public.recruitment_status NOT NULL DEFAULT 'new',
  rejected_reason_id uuid REFERENCES public.rejection_reasons(id),
  rejected_note text,
  interview_date date,
  hire_date date,
  notes text,
  imported_batch_id uuid REFERENCES public.recruitment_import_batches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rc_project ON public.recruitment_candidates(project_id);
CREATE INDEX idx_rc_job_title ON public.recruitment_candidates(job_title_id);
CREATE INDEX idx_rc_status ON public.recruitment_candidates(status);

-- Updated_at triggers
CREATE TRIGGER trg_rp_updated BEFORE UPDATE ON public.recruitment_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rjt_updated BEFORE UPDATE ON public.recruitment_job_titles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rc_updated BEFORE UPDATE ON public.recruitment_candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enforce mandatory rejected_reason when status='rejected'
CREATE OR REPLACE FUNCTION public.recruitment_validate_rejection()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status = 'rejected' AND NEW.rejected_reason_id IS NULL THEN
    RAISE EXCEPTION 'rejected_reason_id is required when status is rejected';
  END IF;
  IF NEW.status = 'hired' AND NEW.hire_date IS NULL THEN
    NEW.hire_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_rc_validate BEFORE INSERT OR UPDATE ON public.recruitment_candidates
  FOR EACH ROW EXECUTE FUNCTION public.recruitment_validate_rejection();

-- Sync recruitment_job_titles -> job_postings
CREATE OR REPLACE FUNCTION public.sync_recruitment_job_to_board()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  v_project public.recruitment_projects%ROWTYPE;
  v_posting_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.synced_job_posting_id IS NOT NULL THEN
      UPDATE public.job_postings SET is_active=false WHERE id = OLD.synced_job_posting_id;
    END IF;
    RETURN OLD;
  END IF;

  SELECT * INTO v_project FROM public.recruitment_projects WHERE id = NEW.project_id;

  IF NEW.is_published_to_board AND NEW.is_active THEN
    IF NEW.synced_job_posting_id IS NULL THEN
      INSERT INTO public.job_postings (
        title_ar, title_en, location, job_type, department, department_en,
        requirements_ar, requirements_en, nationality_required, vacancy_count, is_active, salary_range
      ) VALUES (
        NEW.title_ar, NEW.title_en, COALESCE(NEW.location,'الرياض'), COALESCE(NEW.job_type,'دوام كامل'),
        v_project.name_ar, v_project.name_en,
        NEW.requirements_ar, NEW.requirements_en, NEW.nationality_required,
        GREATEST(NEW.target_headcount,1), true, NEW.salary_range
      ) RETURNING id INTO v_posting_id;
      NEW.synced_job_posting_id := v_posting_id;
    ELSE
      UPDATE public.job_postings SET
        title_ar=NEW.title_ar, title_en=NEW.title_en,
        location=COALESCE(NEW.location,location),
        job_type=COALESCE(NEW.job_type,job_type),
        department=v_project.name_ar, department_en=v_project.name_en,
        requirements_ar=NEW.requirements_ar, requirements_en=NEW.requirements_en,
        nationality_required=NEW.nationality_required,
        vacancy_count=GREATEST(NEW.target_headcount,1),
        salary_range=NEW.salary_range,
        is_active=true,
        updated_at=now()
      WHERE id = NEW.synced_job_posting_id;
    END IF;
  ELSE
    IF NEW.synced_job_posting_id IS NOT NULL THEN
      UPDATE public.job_postings SET is_active=false WHERE id = NEW.synced_job_posting_id;
    END IF;
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_rjt_sync BEFORE INSERT OR UPDATE ON public.recruitment_job_titles
  FOR EACH ROW EXECUTE FUNCTION public.sync_recruitment_job_to_board();
CREATE TRIGGER trg_rjt_sync_del AFTER DELETE ON public.recruitment_job_titles
  FOR EACH ROW EXECUTE FUNCTION public.sync_recruitment_job_to_board();

-- Performance view
CREATE OR REPLACE VIEW public.recruitment_job_title_stats AS
SELECT
  jt.id AS job_title_id,
  jt.project_id,
  p.name_ar AS project_name_ar,
  p.name_en AS project_name_en,
  jt.title_ar,
  jt.title_en,
  jt.target_headcount,
  jt.is_active,
  jt.is_published_to_board,
  COUNT(c.*) FILTER (WHERE c.status='hired') AS hired_count,
  COUNT(c.*) FILTER (WHERE c.status='interviewed') AS interviewed_count,
  COUNT(c.*) FILTER (WHERE c.status='new') AS awaiting_count,
  COUNT(c.*) FILTER (WHERE c.status='selected') AS selected_count,
  COUNT(c.*) FILTER (WHERE c.status='offer_accepted') AS offer_accepted_count,
  COUNT(c.*) FILTER (WHERE c.status='rejected') AS rejected_count,
  GREATEST(jt.target_headcount - COUNT(c.*) FILTER (WHERE c.status='hired')::int, 0) AS remaining_gap
FROM public.recruitment_job_titles jt
LEFT JOIN public.recruitment_projects p ON p.id = jt.project_id
LEFT JOIN public.recruitment_candidates c ON c.job_title_id = jt.id
GROUP BY jt.id, p.name_ar, p.name_en;

-- RLS
ALTER TABLE public.recruitment_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_import_batches ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "HR view projects" ON public.recruitment_projects FOR SELECT TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR insert projects" ON public.recruitment_projects FOR INSERT TO authenticated WITH CHECK (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR update projects" ON public.recruitment_projects FOR UPDATE TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin delete projects" ON public.recruitment_projects FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- Job titles policies
CREATE POLICY "HR view job titles" ON public.recruitment_job_titles FOR SELECT TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR insert job titles" ON public.recruitment_job_titles FOR INSERT TO authenticated WITH CHECK (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR update job titles" ON public.recruitment_job_titles FOR UPDATE TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin delete job titles" ON public.recruitment_job_titles FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- Candidates policies
CREATE POLICY "HR view candidates" ON public.recruitment_candidates FOR SELECT TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR insert candidates" ON public.recruitment_candidates FOR INSERT TO authenticated WITH CHECK (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR update candidates" ON public.recruitment_candidates FOR UPDATE TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin delete candidates" ON public.recruitment_candidates FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- Import batches
CREATE POLICY "HR view batches" ON public.recruitment_import_batches FOR SELECT TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "HR insert batches" ON public.recruitment_import_batches FOR INSERT TO authenticated WITH CHECK (is_admin_or_hr(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.recruitment_candidates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recruitment_job_titles;
ALTER TABLE public.recruitment_candidates REPLICA IDENTITY FULL;
ALTER TABLE public.recruitment_job_titles REPLICA IDENTITY FULL;
