
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS apply_title_ar text DEFAULT 'انضم لفريق مجموعة الخولي',
  ADD COLUMN IF NOT EXISTS apply_title_en text DEFAULT 'Join AlKholi Group Team',
  ADD COLUMN IF NOT EXISTS apply_desc_ar text DEFAULT 'يرجى تعبئة النموذج التالي بدقة. سيتم التواصل معك بعد مراجعة طلبك.',
  ADD COLUMN IF NOT EXISTS apply_desc_en text DEFAULT 'Please fill out the following form carefully. We will contact you after reviewing your application.',
  ADD COLUMN IF NOT EXISTS success_title_ar text DEFAULT 'تم إرسال طلبك بنجاح!',
  ADD COLUMN IF NOT EXISTS success_title_en text DEFAULT 'Application Submitted Successfully!',
  ADD COLUMN IF NOT EXISTS success_desc_ar text DEFAULT 'شكراً لتقديمك. سيتم مراجعة طلبك والتواصل معك في أقرب وقت.',
  ADD COLUMN IF NOT EXISTS success_desc_en text DEFAULT 'Thank you for applying. Your application will be reviewed and we will contact you soon.';
