-- Client-side workspace tools for organizing revealed candidates: custom
-- folders, private notes, and an internal follow-up status -- all scoped to
-- the client's own organization via direct RLS (no edge function needed,
-- same as client_saved_filters). None of this touches applicant PII masking
-- -- it's purely the client org's own organizational metadata about
-- candidates they've already revealed.

-- =========================================================================
-- Folders (e.g. "Riyadh branch shortlist", "Urgent")
-- =========================================================================
CREATE TABLE public.client_candidate_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.client_candidate_folder_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.client_candidate_folders(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  added_by uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (folder_id, applicant_id)
);

-- =========================================================================
-- Private notes -- one editable note per (org, applicant) pair, not a log.
-- =========================================================================
CREATE TABLE public.client_candidate_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_organization_id, applicant_id)
);

-- =========================================================================
-- Internal follow-up status -- entirely separate from applicants.status
-- (the admin's internal ATS pipeline stage). One row per (org, applicant).
-- =========================================================================
CREATE TABLE public.client_candidate_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('contacted', 'interview_scheduled', 'hired', 'rejected')),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_organization_id, applicant_id)
);

ALTER TABLE public.client_candidate_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_candidate_folder_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_candidate_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_candidate_status ENABLE ROW LEVEL SECURITY;

-- Admin: full access to all four tables for oversight.
CREATE POLICY "Admins manage client candidate folders" ON public.client_candidate_folders
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage client candidate folder items" ON public.client_candidate_folder_items
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage client candidate notes" ON public.client_candidate_notes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage client candidate status" ON public.client_candidate_status
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Folders: shared across the whole org's team (same collaborative model as
-- client_saved_filters) -- any active client user of the org can see,
-- create, and delete folders/items for their own org.
CREATE POLICY "Clients view own org folders" ON public.client_candidate_folders
  FOR SELECT USING (client_organization_id = public.get_my_client_organization_id());
CREATE POLICY "Clients create own org folders" ON public.client_candidate_folders
  FOR INSERT WITH CHECK (client_organization_id = public.get_my_client_organization_id() AND created_by = auth.uid());
CREATE POLICY "Clients delete own org folders" ON public.client_candidate_folders
  FOR DELETE USING (client_organization_id = public.get_my_client_organization_id());

CREATE POLICY "Clients view own org folder items" ON public.client_candidate_folder_items
  FOR SELECT USING (
    folder_id IN (SELECT id FROM public.client_candidate_folders WHERE client_organization_id = public.get_my_client_organization_id())
  );
CREATE POLICY "Clients add own org folder items" ON public.client_candidate_folder_items
  FOR INSERT WITH CHECK (
    added_by = auth.uid()
    AND folder_id IN (SELECT id FROM public.client_candidate_folders WHERE client_organization_id = public.get_my_client_organization_id())
  );
CREATE POLICY "Clients remove own org folder items" ON public.client_candidate_folder_items
  FOR DELETE USING (
    folder_id IN (SELECT id FROM public.client_candidate_folders WHERE client_organization_id = public.get_my_client_organization_id())
  );

-- Notes and status: same shared-within-org model, upsert-friendly via the
-- UNIQUE(org, applicant) constraint.
CREATE POLICY "Clients view own org notes" ON public.client_candidate_notes
  FOR SELECT USING (client_organization_id = public.get_my_client_organization_id());
CREATE POLICY "Clients upsert own org notes" ON public.client_candidate_notes
  FOR INSERT WITH CHECK (client_organization_id = public.get_my_client_organization_id() AND updated_by = auth.uid());
CREATE POLICY "Clients update own org notes" ON public.client_candidate_notes
  FOR UPDATE USING (client_organization_id = public.get_my_client_organization_id())
  WITH CHECK (client_organization_id = public.get_my_client_organization_id() AND updated_by = auth.uid());

CREATE POLICY "Clients view own org status" ON public.client_candidate_status
  FOR SELECT USING (client_organization_id = public.get_my_client_organization_id());
CREATE POLICY "Clients upsert own org status" ON public.client_candidate_status
  FOR INSERT WITH CHECK (client_organization_id = public.get_my_client_organization_id() AND updated_by = auth.uid());
CREATE POLICY "Clients update own org status" ON public.client_candidate_status
  FOR UPDATE USING (client_organization_id = public.get_my_client_organization_id())
  WITH CHECK (client_organization_id = public.get_my_client_organization_id() AND updated_by = auth.uid());

CREATE INDEX idx_client_candidate_folders_org ON public.client_candidate_folders(client_organization_id);
CREATE INDEX idx_client_candidate_folder_items_folder ON public.client_candidate_folder_items(folder_id);
CREATE INDEX idx_client_candidate_folder_items_applicant ON public.client_candidate_folder_items(applicant_id);
CREATE INDEX idx_client_candidate_notes_org_applicant ON public.client_candidate_notes(client_organization_id, applicant_id);
CREATE INDEX idx_client_candidate_status_org_applicant ON public.client_candidate_status(client_organization_id, applicant_id);

NOTIFY pgrst, 'reload schema';
