
-- Add soft-delete columns
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_applicants_is_archived ON public.applicants (is_archived);
