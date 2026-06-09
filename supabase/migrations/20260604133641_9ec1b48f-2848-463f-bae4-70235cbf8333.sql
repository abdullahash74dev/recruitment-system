
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS jobs_group_by_location boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS jobs_show_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS jobs_section_title_ar text DEFAULT 'وظائف',
  ADD COLUMN IF NOT EXISTS jobs_section_title_en text DEFAULT 'Jobs in',
  ADD COLUMN IF NOT EXISTS jobs_completed_label_ar text DEFAULT 'وظائف مكتملة',
  ADD COLUMN IF NOT EXISTS jobs_completed_label_en text DEFAULT 'Filled positions',
  ADD COLUMN IF NOT EXISTS jobs_other_label_ar text DEFAULT 'مناطق أخرى',
  ADD COLUMN IF NOT EXISTS jobs_other_label_en text DEFAULT 'Other locations';
