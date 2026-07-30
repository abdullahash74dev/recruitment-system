-- Email templates + campaigns.
--
-- NOTE ON DELIVERY: nothing in this module actually sends mail. SMTP / Resend /
-- SendGrid credentials must never reach the browser, so real delivery has to be
-- driven by an edge function holding those secrets. Until that exists these
-- tables are the system of record: recruiters author the bilingual copy here,
-- record which audience a campaign targeted, and keep the sent/failed tallies
-- in one place. `sending` is therefore a state a human (or a future worker)
-- sets — the UI never assumes a background job is running.

-- Reusable bilingual message bodies. Placeholders ({{name}}, {{position}},
-- {{date}}, {{company}}) are substituted at send time, not stored expanded, so
-- one template serves every recipient.
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject_ar text,
  subject_en text,
  body_ar text,
  body_en text,
  -- Drives the filter chips and the badge colour in the templates grid.
  category text DEFAULT 'general'
    CHECK (category IN ('general','interview','offer','rejection','onboarding','reminder')),
  -- Inactive templates stay readable/auditable but are hidden from the
  -- campaign picker instead of being deleted.
  is_active boolean DEFAULT true,
  -- Incremented whenever a campaign referencing this template completes.
  -- Denormalised on purpose: campaigns can be deleted, the usage history
  -- shouldn't vanish with them.
  use_count int DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per bulk send. The audience is stored as a filter expression rather
-- than a materialised recipient list so a scheduled campaign picks up
-- applicants who match at send time, not at creation time.
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  -- ON DELETE SET NULL: a completed campaign's counts stay meaningful even
  -- after the template it used is removed.
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  -- Free-text audience expression, e.g. `status=new` or
  -- `desired_position=Accountant`. Interpreted by the sender, kept loose so new
  -- filter dimensions don't need a migration.
  target_filter text,
  recipient_count int DEFAULT 0,
  sent_count int DEFAULT 0,
  failed_count int DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sending','completed','cancelled')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage email_templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage email_campaigns" ON public.email_campaigns
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_email_templates_created ON public.email_templates (created_at DESC);
-- Category/active filters drive the templates grid.
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON public.email_templates (category);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON public.email_templates (is_active);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_created ON public.email_campaigns (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_template ON public.email_campaigns (template_id);
-- A future dispatch worker polls for `scheduled` rows that are due.
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled ON public.email_campaigns (scheduled_at)
  WHERE status = 'scheduled';

-- Seed the four templates every hiring pipeline needs on day one. Guarded by a
-- NOT EXISTS on the name so re-running the migration never duplicates them and
-- never overwrites copy an admin has since edited.
INSERT INTO public.email_templates (name, category, subject_ar, subject_en, body_ar, body_en)
SELECT v.name, v.category, v.subject_ar, v.subject_en, v.body_ar, v.body_en
FROM (VALUES
  (
    'دعوة لمقابلة',
    'interview',
    'دعوة لمقابلة وظيفة {{position}} لدى {{company}}',
    'Interview Invitation for {{position}} at {{company}}',
    E'مرحباً {{name}}،\n\nيسعدنا في {{company}} دعوتك لإجراء مقابلة لوظيفة {{position}}.\n\nموعد المقابلة: {{date}}\n\nيرجى تأكيد حضورك بالرد على هذه الرسالة. في حال تعذّر عليك الحضور في الموعد المحدد، أخبرنا لنقترح موعداً بديلاً.\n\nنتطلع للقائك.\n\nمع التحية،\nفريق التوظيف - {{company}}',
    E'Hello {{name}},\n\nWe are pleased to invite you to an interview for the {{position}} role at {{company}}.\n\nInterview date: {{date}}\n\nPlease reply to this email to confirm your attendance. If the proposed time does not suit you, let us know and we will arrange an alternative.\n\nWe look forward to meeting you.\n\nBest regards,\nRecruitment Team - {{company}}'
  ),
  (
    'عرض وظيفي',
    'offer',
    'عرض وظيفي لشغل وظيفة {{position}} لدى {{company}}',
    'Job Offer: {{position}} at {{company}}',
    E'عزيزي/عزيزتي {{name}}،\n\nيسرّنا أن نقدم لك عرضاً للانضمام إلى {{company}} في وظيفة {{position}}.\n\nتاريخ المباشرة المقترح: {{date}}\n\nتجد في المرفقات تفاصيل العرض الكاملة شاملة الراتب والمزايا. نرجو إفادتنا بقبولك خلال خمسة أيام عمل من تاريخ هذه الرسالة.\n\nنتطلع لانضمامك إلى فريقنا.\n\nمع التحية،\nفريق التوظيف - {{company}}',
    E'Dear {{name}},\n\nWe are delighted to offer you the position of {{position}} at {{company}}.\n\nProposed start date: {{date}}\n\nAttached you will find the full offer details, including salary and benefits. Kindly confirm your acceptance within five business days of this message.\n\nWe look forward to welcoming you to the team.\n\nBest regards,\nRecruitment Team - {{company}}'
  ),
  (
    'اعتذار عن الترشيح',
    'rejection',
    'بخصوص طلب التوظيف الخاص بك لوظيفة {{position}}',
    'Update on your application for {{position}}',
    E'مرحباً {{name}}،\n\nنشكرك على اهتمامك بالعمل لدى {{company}} وعلى الوقت الذي خصصته للتقدم لوظيفة {{position}}.\n\nبعد دراسة طلبك بعناية، نعتذر عن عدم مواصلة إجراءات الترشيح في هذه المرحلة، إذ وقع الاختيار على مرشح أقرب لمتطلبات الوظيفة.\n\nسنحتفظ ببياناتك ضمن قاعدة المواهب لدينا وسنتواصل معك عند توفر فرصة تناسب خبراتك.\n\nنتمنى لك التوفيق.\n\nمع التحية،\nفريق التوظيف - {{company}}',
    E'Hello {{name}},\n\nThank you for your interest in {{company}} and for the time you invested in applying for the {{position}} role.\n\nAfter careful consideration, we will not be moving forward with your application at this stage, as we have selected a candidate whose profile more closely matches the requirements.\n\nWe will keep your details in our talent pool and will reach out should a suitable opportunity arise.\n\nWe wish you every success.\n\nBest regards,\nRecruitment Team - {{company}}'
  ),
  (
    'ترحيب بالموظف الجديد',
    'onboarding',
    'أهلاً بك في {{company}}!',
    'Welcome to {{company}}!',
    E'مرحباً {{name}}،\n\nأهلاً بك في {{company}}! يسعدنا انضمامك إلى الفريق في وظيفة {{position}}.\n\nيوم المباشرة: {{date}}\n\nيرجى الحضور إلى مقر الشركة ومعك أصول مستنداتك الشخصية. سيستقبلك فريق الموارد البشرية ويطلعك على خطة الأيام الأولى وتجهيزات العمل.\n\nإن كان لديك أي استفسار قبل المباشرة، لا تتردد في التواصل معنا.\n\nأهلاً بك مجدداً،\nفريق الموارد البشرية - {{company}}',
    E'Hello {{name}},\n\nWelcome to {{company}}! We are excited to have you join the team as {{position}}.\n\nStart date: {{date}}\n\nPlease come to the office with the originals of your personal documents. The HR team will meet you, walk you through your first-week plan, and hand over your equipment.\n\nIf you have any questions before your start date, do not hesitate to contact us.\n\nWelcome aboard,\nHR Team - {{company}}'
  )
) AS v(name, category, subject_ar, subject_en, body_ar, body_en)
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t WHERE t.name = v.name
);

NOTIFY pgrst, 'reload schema';
