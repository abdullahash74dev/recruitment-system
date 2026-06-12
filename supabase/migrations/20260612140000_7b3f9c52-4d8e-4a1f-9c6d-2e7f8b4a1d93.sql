
-- Rebrand: update site_settings column defaults and existing default values
-- from the previous "AlKholi Group" branding to the new "NexHire AI" branding
-- and from the old navy/green colors to the new Quantum Blue palette.
-- Only rows that still hold the original default values are updated, so any
-- admin customizations are preserved.

ALTER TABLE public.site_settings
  ALTER COLUMN primary_color SET DEFAULT '#3b82f6',
  ALTER COLUMN accent_color SET DEFAULT '#22d3ee',
  ALTER COLUMN site_name_ar SET DEFAULT 'منصة التوظيف الذكية',
  ALTER COLUMN site_name_en SET DEFAULT 'NexHire AI',
  ALTER COLUMN hero_title2_ar SET DEFAULT 'مع منصة التوظيف الذكية',
  ALTER COLUMN hero_title2_en SET DEFAULT 'With NexHire AI',
  ALTER COLUMN apply_title_ar SET DEFAULT 'انضم لفريق منصة التوظيف الذكية',
  ALTER COLUMN apply_title_en SET DEFAULT 'Join the NexHire AI Team',
  ALTER COLUMN job_page_brand_text_ar SET DEFAULT 'NEXHIRE AI',
  ALTER COLUMN job_page_brand_text_en SET DEFAULT 'NEXHIRE AI',
  ALTER COLUMN job_page_apply_desc_ar SET DEFAULT 'قدّم طلبك الآن وانضم لفريق منصة التوظيف الذكية',
  ALTER COLUMN job_page_apply_desc_en SET DEFAULT 'Apply now and join the NexHire AI team',
  ALTER COLUMN training_page_desc_ar SET DEFAULT 'انضم لبرامج التدريب التعاوني وتمهير في منصة التوظيف الذكية',
  ALTER COLUMN training_page_desc_en SET DEFAULT 'Join our Co-op and Tamheer training programs at NexHire AI';

UPDATE public.site_settings SET
  primary_color = '#3b82f6'
  WHERE primary_color = '#1a365d';

UPDATE public.site_settings SET
  accent_color = '#22d3ee'
  WHERE accent_color = '#2f855a';

UPDATE public.site_settings SET
  site_name_ar = 'منصة التوظيف الذكية'
  WHERE site_name_ar = 'مجموعة الخولي';

UPDATE public.site_settings SET
  site_name_en = 'NexHire AI'
  WHERE site_name_en = 'AlKholi Group';

UPDATE public.site_settings SET
  hero_title2_ar = 'مع منصة التوظيف الذكية'
  WHERE hero_title2_ar = 'مع مجموعة الخولي';

UPDATE public.site_settings SET
  hero_title2_en = 'With NexHire AI'
  WHERE hero_title2_en = 'With AlKholi Group';

UPDATE public.site_settings SET
  apply_title_ar = 'انضم لفريق منصة التوظيف الذكية'
  WHERE apply_title_ar = 'انضم لفريق مجموعة الخولي';

UPDATE public.site_settings SET
  apply_title_en = 'Join the NexHire AI Team'
  WHERE apply_title_en = 'Join AlKholi Group Team';

UPDATE public.site_settings SET
  job_page_brand_text_ar = 'NEXHIRE AI'
  WHERE job_page_brand_text_ar = 'ALKHOLI GROUP';

UPDATE public.site_settings SET
  job_page_brand_text_en = 'NEXHIRE AI'
  WHERE job_page_brand_text_en = 'ALKHOLI GROUP';

UPDATE public.site_settings SET
  job_page_apply_desc_ar = 'قدّم طلبك الآن وانضم لفريق منصة التوظيف الذكية'
  WHERE job_page_apply_desc_ar = 'قدّم طلبك الآن وانضم لفريق مجموعة الخولي';

UPDATE public.site_settings SET
  job_page_apply_desc_en = 'Apply now and join the NexHire AI team'
  WHERE job_page_apply_desc_en = 'Apply now and join the AlKholi Group team';

UPDATE public.site_settings SET
  training_page_desc_ar = 'انضم لبرامج التدريب التعاوني وتمهير في منصة التوظيف الذكية'
  WHERE training_page_desc_ar = 'انضم لبرامج التدريب التعاوني وتمهير في مجموعة الخولي';

UPDATE public.site_settings SET
  training_page_desc_en = 'Join our Co-op and Tamheer training programs at NexHire AI'
  WHERE training_page_desc_en = 'Join our Co-op and Tamheer training programs at AlKholi Group';
