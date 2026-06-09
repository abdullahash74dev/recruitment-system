-- Add new columns to job_advertisements
ALTER TABLE public.job_advertisements
  ADD COLUMN IF NOT EXISTS manual_jobs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS background_url text,
  ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#2f855a',
  ADD COLUMN IF NOT EXISTS text_color text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS layout_type text NOT NULL DEFAULT 'grid',
  ADD COLUMN IF NOT EXISTS show_qr boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS qr_url text,
  ADD COLUMN IF NOT EXISTS ai_metadata jsonb DEFAULT '{}'::jsonb;

-- Create storage bucket for ad assets (logos, backgrounds)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-assets', 'ad-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for ad-assets
CREATE POLICY "Anyone can view ad assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'ad-assets');

CREATE POLICY "Admins can upload ad assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ad-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update ad assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'ad-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete ad assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'ad-assets' AND has_role(auth.uid(), 'admin'::app_role));