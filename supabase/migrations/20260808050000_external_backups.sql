-- Tracks files/data this business has copied OUT of Supabase into storage
-- it directly owns (e.g. OneDrive) -- independent of this SaaS project, so
-- the underlying files remain accessible/ownable even if Supabase access
-- is ever lost. Written only by the standalone scripts/onedrive-backup/
-- tool (via the service role key), never by the web app itself. Read here
-- by the admin dashboard so an admin can see, at a glance, which résumés
-- still have no off-platform copy yet.
CREATE TABLE public.external_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid REFERENCES public.applicants(id) ON DELETE CASCADE,
  file_kind text NOT NULL, -- 'resume' | 'degree' | 'training' | 'other' | 'data_export'
  supabase_path text,
  destination text NOT NULL DEFAULT 'onedrive',
  external_item_id text,
  external_web_url text,
  file_size bigint,
  status text NOT NULL DEFAULT 'success', -- 'success' | 'error'
  error_message text,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

-- One backup record per (applicant, file kind, destination) -- re-running
-- the script upserts onto the same row instead of piling up duplicates.
-- Partial (applicant_id IS NOT NULL) so multiple whole-database
-- data_export rows (applicant_id NULL) are still allowed.
CREATE UNIQUE INDEX external_backups_applicant_kind_dest_uq
  ON public.external_backups (applicant_id, file_kind, destination)
  WHERE applicant_id IS NOT NULL;

CREATE INDEX external_backups_status_idx ON public.external_backups (status);

ALTER TABLE public.external_backups ENABLE ROW LEVEL SECURITY;

-- Read-only for admins in the dashboard. No INSERT/UPDATE policy: rows are
-- only ever written by the offline script using the service role key,
-- which bypasses RLS entirely -- the web app never writes to this table.
CREATE POLICY "Admins view external backups"
  ON public.external_backups
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

NOTIFY pgrst, 'reload schema';
