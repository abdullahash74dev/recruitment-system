
-- 1) Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  severity text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin insert any notification" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 2) Scheduled reports
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  report_type text NOT NULL DEFAULT 'recruitment_summary',
  format text NOT NULL DEFAULT 'excel',
  frequency text NOT NULL DEFAULT 'weekly',
  recipient_user_ids uuid[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage scheduled_reports sel" ON public.scheduled_reports FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage scheduled_reports ins" ON public.scheduled_reports FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage scheduled_reports upd" ON public.scheduled_reports FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage scheduled_reports del" ON public.scheduled_reports FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_report_id uuid REFERENCES public.scheduled_reports(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'success',
  file_url text,
  file_name text,
  error_message text,
  run_at timestamptz NOT NULL DEFAULT now(),
  triggered_by uuid
);
ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view report_runs" ON public.report_runs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin insert report_runs" ON public.report_runs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3) manage_projects permission: extend RLS on recruitment_projects + job_titles
DROP POLICY IF EXISTS "HR insert projects" ON public.recruitment_projects;
DROP POLICY IF EXISTS "HR update projects" ON public.recruitment_projects;
DROP POLICY IF EXISTS "Admin delete projects" ON public.recruitment_projects;
CREATE POLICY "Projects insert" ON public.recruitment_projects FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_hr(auth.uid()) OR has_permission(auth.uid(), 'manage_projects'));
CREATE POLICY "Projects update" ON public.recruitment_projects FOR UPDATE TO authenticated
  USING (is_admin_or_hr(auth.uid()) OR has_permission(auth.uid(), 'manage_projects'));
CREATE POLICY "Projects delete" ON public.recruitment_projects FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'manage_projects'));

DROP POLICY IF EXISTS "HR insert job titles" ON public.recruitment_job_titles;
DROP POLICY IF EXISTS "HR update job titles" ON public.recruitment_job_titles;
DROP POLICY IF EXISTS "Admin delete job titles" ON public.recruitment_job_titles;
CREATE POLICY "Job titles insert" ON public.recruitment_job_titles FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_hr(auth.uid()) OR has_permission(auth.uid(), 'manage_projects'));
CREATE POLICY "Job titles update" ON public.recruitment_job_titles FOR UPDATE TO authenticated
  USING (is_admin_or_hr(auth.uid()) OR has_permission(auth.uid(), 'manage_projects'));
CREATE POLICY "Job titles delete" ON public.recruitment_job_titles FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'manage_projects'));

-- 4) Trigger: notify admins on new applicant
CREATE OR REPLACE FUNCTION public.notify_admins_new_applicant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
    INSERT INTO public.notifications(user_id, type, title, body, link, severity, metadata)
    VALUES (r.user_id, 'new_applicant',
      'متقدم جديد: ' || COALESCE(NEW.full_name, '—'),
      COALESCE(NEW.desired_position, '') || ' • ' || COALESCE(NEW.nationality, ''),
      '/dashboard?applicant=' || NEW.id::text,
      'info',
      jsonb_build_object('applicant_id', NEW.id, 'source', NEW.source));
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_applicant ON public.applicants;
CREATE TRIGGER trg_notify_new_applicant
AFTER INSERT ON public.applicants
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_applicant();

-- 5) Helper RPC: create notification for all admins (used by edge functions, e.g. AI cap exceeded)
CREATE OR REPLACE FUNCTION public.notify_admins(_type text, _title text, _body text, _link text DEFAULT NULL, _severity text DEFAULT 'info', _metadata jsonb DEFAULT '{}')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; n integer := 0;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
    INSERT INTO public.notifications(user_id, type, title, body, link, severity, metadata)
    VALUES (r.user_id, _type, _title, _body, _link, _severity, COALESCE(_metadata,'{}'::jsonb));
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;

-- 6) Updated_at trigger for scheduled_reports
CREATE TRIGGER trg_scheduled_reports_updated_at
BEFORE UPDATE ON public.scheduled_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
