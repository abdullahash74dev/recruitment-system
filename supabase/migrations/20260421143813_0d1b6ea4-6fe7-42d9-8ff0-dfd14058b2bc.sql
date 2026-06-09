CREATE TABLE public.job_advertisements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  subtitle_ar TEXT,
  subtitle_en TEXT,
  job_ids UUID[] NOT NULL DEFAULT '{}',
  design_style TEXT NOT NULL DEFAULT 'modern',
  accent_color TEXT DEFAULT '#1a365d',
  notes TEXT,
  created_by UUID,
  created_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_advertisements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view advertisements"
ON public.job_advertisements FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can create advertisements"
ON public.job_advertisements FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update advertisements"
ON public.job_advertisements FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete advertisements"
ON public.job_advertisements FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_job_advertisements_updated_at
BEFORE UPDATE ON public.job_advertisements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();