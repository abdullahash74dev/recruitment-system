
-- Create applicant status enum
CREATE TYPE public.applicant_status AS ENUM (
  'new',
  'reviewing',
  'phone_interview',
  'in_person_interview',
  'accepted',
  'hired',
  'rejected',
  'withdrawn'
);

-- Create applicants table
CREATE TABLE public.applicants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  gender TEXT,
  nationality TEXT,
  birth_date DATE,
  marital_status TEXT,
  dependents INTEGER DEFAULT 0,
  phone TEXT,
  email TEXT,
  current_city TEXT,
  has_transport TEXT,
  desired_position TEXT,
  job_type TEXT,
  preferred_city TEXT,
  hear_about TEXT,
  education_level TEXT,
  major TEXT,
  university TEXT,
  graduation_year TEXT,
  gpa TEXT,
  currently_studying TEXT,
  current_study TEXT,
  years_experience TEXT,
  currently_employed TEXT,
  current_title TEXT,
  current_tasks TEXT,
  self_summary TEXT,
  other_experience TEXT,
  arabic_level TEXT,
  english_level TEXT,
  other_language TEXT,
  linkedin TEXT,
  current_salary TEXT,
  expected_salary TEXT,
  available_date TEXT,
  status public.applicant_status NOT NULL DEFAULT 'new',
  notes TEXT,
  resume_url TEXT,
  degree_url TEXT,
  experience_cert_url TEXT,
  training_certs_url TEXT,
  other_docs_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create job postings table
CREATE TABLE public.job_postings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  description_ar TEXT,
  description_en TEXT,
  location TEXT NOT NULL,
  job_type TEXT NOT NULL,
  department TEXT,
  requirements_ar TEXT,
  requirements_en TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

-- Applicants: anyone can insert (public form)
CREATE POLICY "Anyone can submit application"
  ON public.applicants FOR INSERT
  WITH CHECK (true);

-- Applicants: authenticated users (HR) can read all
CREATE POLICY "Authenticated users can view applicants"
  ON public.applicants FOR SELECT
  TO authenticated
  USING (true);

-- Applicants: authenticated users can update
CREATE POLICY "Authenticated users can update applicants"
  ON public.applicants FOR UPDATE
  TO authenticated
  USING (true);

-- Job postings: anyone can view active postings
CREATE POLICY "Anyone can view active job postings"
  ON public.job_postings FOR SELECT
  USING (is_active = true);

-- Job postings: authenticated users can manage
CREATE POLICY "Authenticated users can manage job postings"
  ON public.job_postings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update job postings"
  ON public.job_postings FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete job postings"
  ON public.job_postings FOR DELETE
  TO authenticated
  USING (true);

-- Authenticated users can also view inactive postings
CREATE POLICY "Authenticated users can view all job postings"
  ON public.job_postings FOR SELECT
  TO authenticated
  USING (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_applicants_updated_at
  BEFORE UPDATE ON public.applicants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_postings_updated_at
  BEFORE UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false);

CREATE POLICY "Anyone can upload resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Authenticated users can view resumes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'resumes');
