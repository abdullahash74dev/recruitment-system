
-- Table to store visibility/required config for built-in form fields
CREATE TABLE public.form_field_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name text NOT NULL UNIQUE,
  step_number integer NOT NULL DEFAULT 1,
  is_visible boolean NOT NULL DEFAULT true,
  is_required boolean NOT NULL DEFAULT true,
  label_ar text,
  label_en text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.form_field_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read field config (needed for the form)
CREATE POLICY "Anyone can view field config"
  ON public.form_field_config FOR SELECT
  USING (true);

-- Only admin/HR can manage
CREATE POLICY "Admin can insert field config"
  ON public.form_field_config FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_hr(auth.uid()));

CREATE POLICY "Admin can update field config"
  ON public.form_field_config FOR UPDATE
  TO authenticated
  USING (is_admin_or_hr(auth.uid()));

CREATE POLICY "Admin can delete field config"
  ON public.form_field_config FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_form_field_config_updated_at
  BEFORE UPDATE ON public.form_field_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with all built-in fields
INSERT INTO public.form_field_config (field_name, step_number, is_visible, is_required, label_ar, label_en, sort_order) VALUES
-- Step 1: Basic Info
('fullName', 1, true, true, 'الاسم الكامل', 'Full Name', 1),
('gender', 1, true, true, 'الجنس', 'Gender', 2),
('nationality', 1, true, true, 'الجنسية', 'Nationality', 3),
('birthDate', 1, true, true, 'تاريخ الميلاد', 'Birth Date', 4),
('maritalStatus', 1, true, true, 'الحالة الاجتماعية', 'Marital Status', 5),
('dependents', 1, true, true, 'عدد المعالين', 'Dependents', 6),
('phone', 1, true, true, 'رقم الهاتف', 'Phone', 7),
('email', 1, true, true, 'البريد الإلكتروني', 'Email', 8),
('currentCity', 1, true, true, 'المدينة الحالية', 'Current City', 9),
('hasTransport', 1, true, true, 'هل لديك وسيلة نقل؟', 'Do you have transportation?', 10),
-- Step 2: Job Preferences
('desiredPosition', 2, true, true, 'المسمى الوظيفي المرغوب', 'Desired Position', 1),
('jobType', 2, true, true, 'نوع الوظيفة', 'Job Type', 2),
('preferredCity', 2, true, true, 'المدينة المفضلة', 'Preferred City', 3),
('hearAbout', 2, true, true, 'كيف سمعت عنا؟', 'How did you hear about us?', 4),
-- Step 3: Education
('educationLevel', 3, true, true, 'المستوى التعليمي', 'Education Level', 1),
('major', 3, true, true, 'التخصص', 'Major', 2),
('university', 3, true, true, 'الجامعة', 'University', 3),
('graduationYear', 3, true, true, 'سنة التخرج', 'Graduation Year', 4),
('gpa', 3, true, true, 'المعدل التراكمي', 'GPA', 5),
('currentlyStudying', 3, true, true, 'هل تدرس حالياً؟', 'Currently Studying?', 6),
-- Step 4: Experience
('yearsExperience', 4, true, true, 'سنوات الخبرة', 'Years of Experience', 1),
('currentlyEmployed', 4, true, true, 'هل تعمل حالياً؟', 'Currently Employed?', 2),
('currentTitle', 4, true, true, 'المسمى الوظيفي الحالي', 'Current Title', 3),
('currentTasks', 4, true, true, 'المهام الحالية', 'Current Tasks', 4),
('selfSummary', 4, true, true, 'ملخص شخصي', 'Self Summary', 5),
('otherExperience', 4, true, true, 'خبرات أخرى', 'Other Experience', 6),
('arabicLevel', 4, true, true, 'مستوى العربية', 'Arabic Level', 7),
('englishLevel', 4, true, true, 'مستوى الإنجليزية', 'English Level', 8),
('otherLanguage', 4, true, false, 'لغة أخرى', 'Other Language', 9),
('linkedin', 4, true, true, 'لينكدإن', 'LinkedIn', 10),
('facilityManagementExp', 4, true, false, 'خبرة إدارة المرافق', 'Facility Management Exp.', 11),
-- Step 5: Financials
('currentSalary', 5, true, true, 'الراتب الحالي', 'Current Salary', 1),
('expectedSalary', 5, true, true, 'الراتب المتوقع', 'Expected Salary', 2),
('availableDate', 5, true, true, 'تاريخ الإتاحة', 'Available Date', 3),
-- Step 6: Attachments
('resume', 6, true, true, 'السيرة الذاتية', 'Resume', 1),
('degreeCopy', 6, true, false, 'صورة المؤهل', 'Degree Copy', 2),
('experienceCert', 6, true, false, 'شهادة الخبرة', 'Experience Certificate', 3),
('trainingCerts', 6, true, false, 'شهادات التدريب', 'Training Certificates', 4),
('otherDocs', 6, true, false, 'مستندات أخرى', 'Other Documents', 5);
