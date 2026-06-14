-- Allow admins to customize the homepage hero/apply-page background image
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

NOTIFY pgrst, 'reload schema';
