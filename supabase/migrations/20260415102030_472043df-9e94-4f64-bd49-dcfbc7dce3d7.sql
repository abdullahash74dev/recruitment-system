
-- Site settings table (single row for branding)
CREATE TABLE public.site_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logo_url text DEFAULT NULL,
  primary_color text DEFAULT '#1a365d',
  accent_color text DEFAULT '#2f855a',
  site_name_ar text DEFAULT 'مجموعة الخولي',
  site_name_en text DEFAULT 'AlKholi Group',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site settings" ON public.site_settings FOR SELECT TO public USING (true);
CREATE POLICY "Admin can update site settings" ON public.site_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert site settings" ON public.site_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default row
INSERT INTO public.site_settings (id) VALUES (gen_random_uuid());

-- Dropdown options table for customizable form fields
CREATE TABLE public.dropdown_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_name text NOT NULL UNIQUE,
  options_ar text[] NOT NULL DEFAULT '{}',
  options_en text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dropdown_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active dropdown options" ON public.dropdown_options FOR SELECT TO public USING (true);
CREATE POLICY "Admin can manage dropdown options" ON public.dropdown_options FOR INSERT TO authenticated WITH CHECK (is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin can update dropdown options" ON public.dropdown_options FOR UPDATE TO authenticated USING (is_admin_or_hr(auth.uid()));
CREATE POLICY "Admin can delete dropdown options" ON public.dropdown_options FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dropdown_options_updated_at BEFORE UPDATE ON public.dropdown_options FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
