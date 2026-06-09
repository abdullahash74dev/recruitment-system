
-- Add vacancy count to job postings
ALTER TABLE public.job_postings ADD COLUMN vacancy_count integer NOT NULL DEFAULT 1;

-- Add facility management experience field to applicants
ALTER TABLE public.applicants ADD COLUMN facility_management_exp text;
