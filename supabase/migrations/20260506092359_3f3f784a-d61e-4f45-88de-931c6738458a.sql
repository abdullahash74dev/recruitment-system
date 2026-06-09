DROP POLICY IF EXISTS "Public can view applicant attachments" ON storage.objects;

UPDATE public.site_settings SET delete_pin = NULL;
ALTER TABLE public.site_settings DROP COLUMN IF EXISTS delete_pin;