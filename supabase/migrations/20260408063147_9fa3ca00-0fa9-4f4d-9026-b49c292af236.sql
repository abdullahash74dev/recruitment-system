-- Fix: Create trigger for auto-creating profiles on signup (was missing)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix: Tighten applicant INSERT policy to prevent status/notes tampering
DROP POLICY IF EXISTS "Anyone can submit application" ON public.applicants;
CREATE POLICY "Anyone can submit application"
  ON public.applicants FOR INSERT TO public
  WITH CHECK (status = 'new'::applicant_status AND notes IS NULL);

-- Fix: Add UPDATE/DELETE policies on storage.objects for resumes bucket
CREATE POLICY "HR can update resumes"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND is_admin_or_hr(auth.uid()));

CREATE POLICY "HR can delete resumes"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND is_admin_or_hr(auth.uid()));

-- Fix: Restrict public upload to resumes bucket with file extension check
DROP POLICY IF EXISTS "Anyone can upload resumes" ON storage.objects;
CREATE POLICY "Anyone can upload resumes"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (
    bucket_id = 'resumes'
    AND lower(storage.extension(name)) = ANY (ARRAY['pdf','doc','docx','jpg','jpeg','png'])
  );

-- Ensure profile exists for current user
INSERT INTO public.profiles (user_id, email, display_name)
VALUES ('544312b8-daf0-4f11-bc8c-2ddc78b8945c', 'abdullahash745@gmail.com', 'Abdullah')
ON CONFLICT (user_id) DO NOTHING;