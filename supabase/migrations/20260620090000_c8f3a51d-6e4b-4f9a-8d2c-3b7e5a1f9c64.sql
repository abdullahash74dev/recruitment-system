-- Resume support for the flexible import tool: an interrupted import (tab closed,
-- browser crash, network drop mid-run) currently forces the user to re-upload the
-- file and redo every field mapping + source selection from scratch. Persist the
-- original file and the exact mapping/source settings on the job row itself so a
-- "Resume" action can rebuild the import screen with one click.
ALTER TABLE public.applicant_import_jobs
  ADD COLUMN IF NOT EXISTS mapping_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS file_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('import-drafts', 'import-drafts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "HR read import drafts" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'import-drafts' AND is_admin_or_hr(auth.uid()));
CREATE POLICY "HR upload import drafts" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'import-drafts' AND is_admin_or_hr(auth.uid()));
CREATE POLICY "HR delete import drafts" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'import-drafts' AND is_admin_or_hr(auth.uid()));

NOTIFY pgrst, 'reload schema';
