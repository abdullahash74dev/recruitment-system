ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS logo_padding integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS logo_bg_color text,
  ADD COLUMN IF NOT EXISTS logo_shadow boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo_border boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo_rotation integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logo_offset_x integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logo_offset_y integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logo_fit text NOT NULL DEFAULT 'contain',
  ADD COLUMN IF NOT EXISTS logo_width integer;