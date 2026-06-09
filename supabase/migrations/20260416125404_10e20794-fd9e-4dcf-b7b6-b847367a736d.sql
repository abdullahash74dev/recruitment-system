ALTER TABLE public.site_settings 
  ADD COLUMN IF NOT EXISTS logo_height text DEFAULT '56',
  ADD COLUMN IF NOT EXISTS logo_alignment text DEFAULT 'start',
  ADD COLUMN IF NOT EXISTS logo_border_radius text DEFAULT '8',
  ADD COLUMN IF NOT EXISTS logo_bg_enabled boolean DEFAULT true;