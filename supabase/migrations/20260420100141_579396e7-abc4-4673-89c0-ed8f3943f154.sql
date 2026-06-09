
-- جدول أسباب الرفض
CREATE TABLE public.rejection_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reason_ar TEXT NOT NULL,
  reason_en TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rejection_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active rejection reasons"
  ON public.rejection_reasons FOR SELECT
  USING (true);

CREATE POLICY "HR can insert rejection reasons"
  ON public.rejection_reasons FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_hr(auth.uid()));

CREATE POLICY "HR can update rejection reasons"
  ON public.rejection_reasons FOR UPDATE
  TO authenticated
  USING (is_admin_or_hr(auth.uid()));

CREATE POLICY "Admin can delete rejection reasons"
  ON public.rejection_reasons FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_rejection_reasons_updated_at
  BEFORE UPDATE ON public.rejection_reasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- بيانات افتراضية
INSERT INTO public.rejection_reasons (reason_ar, reason_en, sort_order) VALUES
('الخبرة غير كافية للوظيفة', 'Insufficient experience for the role', 1),
('المؤهل العلمي غير مطابق', 'Educational qualification does not match', 2),
('التخصص غير مناسب', 'Specialization not suitable', 3),
('الراتب المطلوب أعلى من المعروض', 'Expected salary exceeds offered range', 4),
('الموقع الجغرافي غير مناسب', 'Location not suitable', 5),
('عدم توفر الجنسية المطلوبة', 'Required nationality not available', 6),
('تم اختيار مرشح آخر', 'Another candidate was selected', 7),
('لا توجد شواغر حالياً', 'No current vacancies', 8);

-- جدول سجل إيميلات المرشحين
CREATE TABLE public.applicant_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_id UUID NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  status_at_send TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ar',
  subject TEXT,
  body_preview TEXT,
  rejection_reason_id UUID REFERENCES public.rejection_reasons(id),
  rejection_note TEXT,
  send_status TEXT NOT NULL DEFAULT 'queued',
  error_message TEXT,
  sent_by UUID,
  sent_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_applicant_emails_applicant ON public.applicant_emails(applicant_id);
CREATE INDEX idx_applicant_emails_created ON public.applicant_emails(created_at DESC);

ALTER TABLE public.applicant_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can view applicant emails"
  ON public.applicant_emails FOR SELECT
  TO authenticated
  USING (is_admin_or_hr(auth.uid()));

CREATE POLICY "HR can insert applicant emails"
  ON public.applicant_emails FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_hr(auth.uid()));

CREATE POLICY "Admin can delete applicant emails"
  ON public.applicant_emails FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
