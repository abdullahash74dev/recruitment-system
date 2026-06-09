ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS logo_height integer NOT NULL DEFAULT 64,
  ADD COLUMN IF NOT EXISTS logo_width integer,
  ADD COLUMN IF NOT EXISTS logo_fit text NOT NULL DEFAULT 'contain',
  ADD COLUMN IF NOT EXISTS logo_radius integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS logo_rotation integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logo_padding integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logo_bg_color text,
  ADD COLUMN IF NOT EXISTS logo_shadow boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo_border boolean NOT NULL DEFAULT false;