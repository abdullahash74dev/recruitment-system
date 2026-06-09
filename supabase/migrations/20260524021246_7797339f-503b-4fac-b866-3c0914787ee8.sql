-- Add mobile-specific logo dimensions and section background colors to site_settings
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS logo_height_mobile INTEGER,
  ADD COLUMN IF NOT EXISTS logo_width_mobile INTEGER,
  ADD COLUMN IF NOT EXISTS logo_padding_mobile INTEGER,
  ADD COLUMN IF NOT EXISTS logo_bg_color_mobile TEXT,
  ADD COLUMN IF NOT EXISTS logo_border_radius_mobile TEXT,
  ADD COLUMN IF NOT EXISTS hero_bg_color TEXT,
  ADD COLUMN IF NOT EXISTS hero_bg_color_mobile TEXT,
  ADD COLUMN IF NOT EXISTS features_bg_color TEXT,
  ADD COLUMN IF NOT EXISTS stats_bg_color TEXT,
  ADD COLUMN IF NOT EXISTS cta_bg_color TEXT,
  ADD COLUMN IF NOT EXISTS hero_title_size_desktop TEXT DEFAULT '4rem',
  ADD COLUMN IF NOT EXISTS hero_title_size_mobile TEXT DEFAULT '2rem',
  ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#1a365d';

-- Public bucket for site assets (logo uploads)
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for site-assets bucket: anyone can read, only admins can write
DROP POLICY IF EXISTS "Public read site-assets" ON storage.objects;
CREATE POLICY "Public read site-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-assets');

DROP POLICY IF EXISTS "Admins upload site-assets" ON storage.objects;
CREATE POLICY "Admins upload site-assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update site-assets" ON storage.objects;
CREATE POLICY "Admins update site-assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins delete site-assets" ON storage.objects;
CREATE POLICY "Admins delete site-assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));