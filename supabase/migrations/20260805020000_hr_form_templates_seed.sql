-- HR Forms module: seed the first wave of 8 system templates.
-- Rebuilt as data-driven schemas from the company's original paper forms —
-- no legacy branding or hardcoded staff names are carried over: the company
-- logo/name come from site_settings at render time, and every previously
-- hardcoded value (employee name, manager, signatory) is a fillable field.
-- Seeded as status='published' so they are usable immediately; doc_no values
-- use a fresh numbering scheme and are admin-editable.

INSERT INTO public.hr_form_templates
  (slug, title_en, title_ar, category, doc_no, department_owner, version, revision_no, revision_date, schema, status, is_system_seed)
VALUES

-- ---------------------------------------------------------------------------
-- 1) Employee Information
-- ---------------------------------------------------------------------------
('employee-information', 'Employee Information', 'معلومات الموظف', 'general', 'HR-FRM-001', 'HR', 1, '1', CURRENT_DATE, $json$
{
  "sections": [
    {
      "key": "employee_core",
      "title_en": "Employee",
      "title_ar": "الموظف",
      "fields": [
        {"key": "employee_full_name", "type": "text", "label_en": "Name", "label_ar": "الاسم", "source": "employee", "employee_field": "full_name_en", "required": true},
        {"key": "employee_no", "type": "text", "label_en": "Employee ID", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no", "required": true},
        {"key": "department", "type": "text", "label_en": "Department / Program", "label_ar": "الإدارة / البرنامج", "source": "employee", "employee_field": "department"},
        {"key": "job_title", "type": "text", "label_en": "Job Title", "label_ar": "المسمى الوظيفي", "source": "employee", "employee_field": "job_title"},
        {"key": "blood_type", "type": "select", "label_en": "Blood Type", "label_ar": "فصيلة الدم", "source": "submission", "options": [
          {"value": "A+", "label_en": "A+"}, {"value": "A-", "label_en": "A-"}, {"value": "B+", "label_en": "B+"}, {"value": "B-", "label_en": "B-"},
          {"value": "O+", "label_en": "O+"}, {"value": "O-", "label_en": "O-"}, {"value": "AB+", "label_en": "AB+"}, {"value": "AB-", "label_en": "AB-"}
        ]}
      ]
    },
    {
      "key": "personal",
      "title_en": "Personal Details",
      "title_ar": "البيانات الشخصية",
      "fields": [
        {"key": "birth_date", "type": "date", "label_en": "Date of Birth", "label_ar": "تاريخ الميلاد", "source": "employee", "employee_field": "birth_date"},
        {"key": "place_of_birth", "type": "text", "label_en": "Place of Birth", "label_ar": "مكان الميلاد", "source": "submission"},
        {"key": "country_of_birth", "type": "text", "label_en": "Country of Birth", "label_ar": "بلد الميلاد", "source": "submission"},
        {"key": "nationality", "type": "text", "label_en": "Nationality", "label_ar": "الجنسية", "source": "employee", "employee_field": "nationality"},
        {"key": "marital_status", "type": "radio", "label_en": "Marital Status", "label_ar": "الحالة الاجتماعية", "source": "employee", "employee_field": "marital_status", "options": [
          {"value": "single", "label_en": "Single", "label_ar": "أعزب"},
          {"value": "married", "label_en": "Married", "label_ar": "متزوج"}
        ]},
        {"key": "gender", "type": "radio", "label_en": "Gender", "label_ar": "الجنس", "source": "employee", "employee_field": "gender", "options": [
          {"value": "male", "label_en": "Male", "label_ar": "ذكر"},
          {"value": "female", "label_en": "Female", "label_ar": "أنثى"}
        ]},
        {"key": "religion", "type": "text", "label_en": "Religion", "label_ar": "الديانة", "source": "submission"},
        {"key": "type_of_hire", "type": "radio", "label_en": "Type of Hire", "label_ar": "نوع التوظيف", "source": "submission", "options": [
          {"value": "local", "label_en": "Local", "label_ar": "محلي"},
          {"value": "overseas", "label_en": "Overseas", "label_ar": "من الخارج"}
        ]},
        {"key": "dependents_in_kingdom", "type": "text", "label_en": "Dependents in Kingdom", "label_ar": "المرافقون داخل المملكة", "source": "submission", "placeholder_en": "e.g. Wife (1), Son (2)"}
      ]
    },
    {
      "key": "education",
      "title_en": "Education",
      "title_ar": "التعليم",
      "fields": [
        {"key": "degree_type", "type": "text", "label_en": "Type of Degree", "label_ar": "الدرجة العلمية", "source": "submission"},
        {"key": "degree_field", "type": "text", "label_en": "Field", "label_ar": "التخصص", "source": "submission"}
      ]
    },
    {
      "key": "contact",
      "title_en": "Contact Details",
      "title_ar": "بيانات الاتصال",
      "fields": [
        {"key": "saudi_address", "type": "textarea", "label_en": "Saudi Address (home address, P.O. Box, house/flat #)", "label_ar": "العنوان داخل المملكة", "source": "submission"},
        {"key": "phone", "type": "text", "label_en": "Phone Number", "label_ar": "رقم الجوال", "source": "employee", "employee_field": "phone"},
        {"key": "email", "type": "text", "label_en": "E-Mail", "label_ar": "البريد الإلكتروني", "source": "employee", "employee_field": "personal_email"},
        {"key": "home_country_address", "type": "textarea", "label_en": "Home of Record Address (city, state, zip, telephone)", "label_ar": "العنوان في بلد الموطن", "source": "submission"},
        {"key": "nearest_airport", "type": "text", "label_en": "Nearest International Airport", "label_ar": "أقرب مطار دولي", "source": "submission"}
      ]
    },
    {
      "key": "emergency",
      "title_en": "Emergency Contacts",
      "title_ar": "جهات اتصال الطوارئ",
      "fields": [
        {"key": "emergency_contacts", "type": "table", "label_en": "In case of emergency, contact", "label_ar": "في حالة الطوارئ يتم التواصل مع", "source": "submission", "min_rows": 1, "columns": [
          {"key": "name", "type": "text", "label_en": "Name", "label_ar": "الاسم"},
          {"key": "address", "type": "text", "label_en": "Address", "label_ar": "العنوان"},
          {"key": "phone", "type": "text", "label_en": "Phone Number", "label_ar": "رقم الهاتف"},
          {"key": "email", "type": "text", "label_en": "E-mail", "label_ar": "البريد الإلكتروني"}
        ]}
      ]
    },
    {
      "key": "declaration",
      "title_en": "Declaration",
      "title_ar": "الإقرار",
      "note_en": "I hereby confirm my responsibility for the accuracy of the information listed above, and undertake to notify HR of any change.",
      "note_ar": "أقر بمسؤوليتي عن صحة المعلومات المذكورة أعلاه وأتعهد بإبلاغ الموارد البشرية بأي تغيير.",
      "fields": [
        {"key": "declaration_name", "type": "text", "label_en": "Name", "label_ar": "الاسم", "source": "employee", "employee_field": "full_name_en"},
        {"key": "declaration_date", "type": "date", "label_en": "Date", "label_ar": "التاريخ", "source": "submission"}
      ]
    }
  ]
}
$json$::jsonb, 'published', true),

-- ---------------------------------------------------------------------------
-- 2) Annual Leave Request
-- ---------------------------------------------------------------------------
('annual-leave-request', 'Leave Application Form', 'طلب إجازة', 'leave', 'HR-FRM-002', 'HR', 1, '1', CURRENT_DATE, $json$
{
  "sections": [
    {
      "key": "personal",
      "title_en": "Personal Details",
      "title_ar": "البيانات الشخصية",
      "fields": [
        {"key": "employee_full_name", "type": "text", "label_en": "Name", "label_ar": "الاسم", "source": "employee", "employee_field": "full_name_en", "required": true},
        {"key": "employee_no", "type": "text", "label_en": "Employee ID", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no", "required": true},
        {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"},
        {"key": "job_title", "type": "text", "label_en": "Job Title", "label_ar": "المسمى الوظيفي", "source": "employee", "employee_field": "job_title"},
        {"key": "hire_date", "type": "date", "label_en": "Joining Date", "label_ar": "تاريخ الالتحاق", "source": "employee", "employee_field": "hire_date"},
        {"key": "nationality", "type": "text", "label_en": "Nationality", "label_ar": "الجنسية", "source": "employee", "employee_field": "nationality"},
        {"key": "line_manager", "type": "text", "label_en": "Line Manager", "label_ar": "المدير المباشر", "source": "submission", "required": true},
        {"key": "last_working_date", "type": "date", "label_en": "Last Working Date", "label_ar": "آخر يوم عمل", "source": "submission"}
      ]
    },
    {
      "key": "leave",
      "title_en": "Leave Details",
      "title_ar": "تفاصيل الإجازة",
      "fields": [
        {"key": "leave_type", "type": "radio", "label_en": "Type of Vacation", "label_ar": "نوع الإجازة", "source": "submission", "required": true, "options": [
          {"value": "annual", "label_en": "Annual Leave", "label_ar": "إجازة سنوية"},
          {"value": "unpaid", "label_en": "Unpaid Leave", "label_ar": "إجازة بدون راتب"},
          {"value": "sick", "label_en": "Sick Leave", "label_ar": "إجازة مرضية"},
          {"value": "death", "label_en": "Death Case", "label_ar": "حالة وفاة"},
          {"value": "maternity", "label_en": "Maternity Leave", "label_ar": "إجازة أمومة"},
          {"value": "marriage", "label_en": "Marriage Leave", "label_ar": "إجازة زواج"},
          {"value": "other", "label_en": "Other", "label_ar": "أخرى"}
        ]},
        {"key": "leave_type_other", "type": "text", "label_en": "Other (specify)", "label_ar": "أخرى (حدد)", "source": "submission"},
        {"key": "vacation_start", "type": "date", "label_en": "Vacation Start", "label_ar": "بداية الإجازة", "source": "submission", "required": true},
        {"key": "vacation_end", "type": "date", "label_en": "Vacation End", "label_ar": "نهاية الإجازة", "source": "submission", "required": true},
        {"key": "total_days", "type": "computed", "label_en": "Total Days", "label_ar": "إجمالي الأيام", "source": "computed", "formula": "date_diff_days(vacation_start, vacation_end)"},
        {"key": "rejoin_date", "type": "date", "label_en": "Re-Join Date", "label_ar": "تاريخ العودة", "source": "submission"},
        {"key": "vacation_payment", "type": "radio", "label_en": "I would like to take my vacation payment", "label_ar": "أرغب باستلام راتب الإجازة", "source": "submission", "options": [
          {"value": "in_advance", "label_en": "In advance", "label_ar": "مقدمًا"},
          {"value": "end_of_month", "label_en": "By end of the month", "label_ar": "نهاية الشهر"}
        ]}
      ]
    },
    {
      "key": "travel",
      "title_en": "Flight Details (non-Saudi employees — travel & ticket arrangements)",
      "title_ar": "تفاصيل الرحلة (لغير السعوديين — ترتيبات السفر والتذاكر)",
      "fields": [
        {"key": "trip_type", "type": "radio", "label_en": "Trip Type", "label_ar": "نوع الرحلة", "source": "submission", "options": [
          {"value": "round_trip", "label_en": "Round Trip", "label_ar": "ذهاب وعودة"},
          {"value": "one_way", "label_en": "One Way", "label_ar": "ذهاب فقط"}
        ]},
        {"key": "travel_from", "type": "text", "label_en": "From", "label_ar": "من", "source": "submission"},
        {"key": "travel_to", "type": "text", "label_en": "To", "label_ar": "إلى", "source": "submission"},
        {"key": "trip_first_day", "type": "date", "label_en": "First Day of Trip", "label_ar": "أول يوم للرحلة", "source": "submission"},
        {"key": "trip_last_day", "type": "date", "label_en": "Last Day of Trip", "label_ar": "آخر يوم للرحلة", "source": "submission"},
        {"key": "travel_remarks", "type": "textarea", "label_en": "Remarks", "label_ar": "ملاحظات", "source": "submission"}
      ]
    },
    {
      "key": "visa",
      "title_en": "Visa Request",
      "title_ar": "طلب التأشيرة",
      "note_en": "This request should be provided 2 weeks before your traveling date. If you do not use your exit re-entry, cancel the visa before the expiry date or a penalty applies.",
      "note_ar": "يجب تقديم هذا الطلب قبل أسبوعين من تاريخ السفر. إذا لم تستخدم تأشيرة الخروج والعودة، قم بإلغائها قبل انتهاء صلاحيتها وإلا تُطبق الغرامة.",
      "fields": [
        {"key": "visa_purpose", "type": "text", "label_en": "Purpose of Visa", "label_ar": "الغرض من التأشيرة", "source": "submission"},
        {"key": "visa_type", "type": "radio", "label_en": "Visa Type", "label_ar": "نوع التأشيرة", "source": "submission", "options": [
          {"value": "single_exit_reentry", "label_en": "Single Exit Re-Entry", "label_ar": "خروج وعودة مرة واحدة"},
          {"value": "multi_exit_reentry", "label_en": "Multi Exit Re-Entry", "label_ar": "خروج وعودة متعدد"},
          {"value": "cancel_exit_reentry", "label_en": "Cancel Exit Re-Entry", "label_ar": "إلغاء خروج وعودة"},
          {"value": "final_exit", "label_en": "Final Exit", "label_ar": "خروج نهائي"}
        ]}
      ]
    },
    {
      "key": "signatures",
      "title_en": "Approvals",
      "title_ar": "الاعتمادات",
      "fields": [
        {"key": "sig_employee", "type": "signature", "label_en": "Employee", "label_ar": "الموظف", "source": "submission"},
        {"key": "sig_line_manager", "type": "signature", "label_en": "Line Manager", "label_ar": "المدير المباشر", "source": "submission"},
        {"key": "sig_head_department", "type": "signature", "label_en": "Head of Department", "label_ar": "مدير الإدارة", "source": "submission"}
      ]
    },
    {
      "key": "hr_use",
      "title_en": "HR Use Only",
      "title_ar": "لاستخدام الموارد البشرية فقط",
      "fields": [
        {"key": "paid_by", "type": "radio", "label_en": "This request is paid by", "label_ar": "تُدفع تكلفة هذا الطلب من قبل", "source": "submission", "options": [
          {"value": "company", "label_en": "Company", "label_ar": "الشركة"},
          {"value": "employee", "label_en": "Employee", "label_ar": "الموظف"}
        ]},
        {"key": "sig_hr_operation", "type": "signature", "label_en": "HR Operations", "label_ar": "عمليات الموارد البشرية", "source": "submission"},
        {"key": "sig_hr_manager", "type": "signature", "label_en": "HR Manager", "label_ar": "مدير الموارد البشرية", "source": "submission"}
      ]
    }
  ]
}
$json$::jsonb, 'published', true),

-- ---------------------------------------------------------------------------
-- 3) Employment Certificate
-- ---------------------------------------------------------------------------
('employment-certificate', 'Employment Certificate', 'شهادة تعريف', 'letters', 'HR-FRM-003', 'HR', 1, '1', CURRENT_DATE, $json$
{
  "sections": [
    {
      "key": "certificate",
      "title_en": "Certificate Details",
      "title_ar": "بيانات الشهادة",
      "fields": [
        {"key": "certificate_date", "type": "date", "label_en": "Date", "label_ar": "التاريخ", "source": "submission", "required": true},
        {"key": "addressed_to", "type": "text", "label_en": "To", "label_ar": "السادة", "source": "submission", "placeholder_en": "To whom it may concern / entity name", "required": true},
        {"key": "employee_full_name", "type": "text", "label_en": "Name", "label_ar": "الاسم", "source": "employee", "employee_field": "full_name_en", "required": true},
        {"key": "employee_no", "type": "text", "label_en": "Employee I.D. #", "label_ar": "رقم بطاقة العمل", "source": "employee", "employee_field": "employee_no", "required": true},
        {"key": "nationality", "type": "text", "label_en": "Citizen of", "label_ar": "الجنسية", "source": "employee", "employee_field": "nationality"},
        {"key": "national_id", "type": "text", "label_en": "ID Card", "label_ar": "رقم الهوية", "source": "employee", "employee_field": "national_id"},
        {"key": "contract_start_date", "type": "date", "label_en": "Contract Start Date", "label_ar": "تاريخ بداية العقد", "source": "employee", "employee_field": "hire_date"},
        {"key": "job_title", "type": "text", "label_en": "Current Job Title", "label_ar": "مسمى الوظيفة الحالي", "source": "employee", "employee_field": "job_title"}
      ]
    },
    {
      "key": "salary",
      "title_en": "Salary Details",
      "title_ar": "بيانات الراتب",
      "fields": [
        {"key": "base_salary", "type": "currency", "label_en": "Monthly Basic Salary", "label_ar": "الراتب الأساسي", "source": "employee", "employee_field": "base_salary"},
        {"key": "housing_allowance", "type": "currency", "label_en": "Monthly Housing Allowance", "label_ar": "بدل السكن", "source": "employee", "employee_field": "housing_allowance"},
        {"key": "transport_allowance", "type": "currency", "label_en": "Transportation Allowance", "label_ar": "بدل المواصلات", "source": "employee", "employee_field": "transport_allowance"},
        {"key": "total_salary", "type": "computed", "label_en": "Monthly Total Salary (SAR)", "label_ar": "الراتب الشهري الإجمالي (ر.س)", "source": "computed", "formula": "sum_fields(base_salary, housing_allowance, transport_allowance)", "format": "currency"}
      ]
    },
    {
      "key": "statement",
      "title_en": "Statement",
      "title_ar": "الإفادة",
      "note_en": "The above mentioned employee works for the company as stated above. This certificate has been issued upon the employee's request without any responsibility, financial, legal or otherwise, on the company's part. It is valid only when the signature and the official stamp are affixed, for one month from its date.",
      "note_ar": "الموظف المذكور أعلاه يعمل لدى الشركة حسب المعلومات المبينة أعلاه. أُصدرت له هذه الشهادة بناءً على طلبه دون أدنى مسؤولية مالية أو قانونية أو خلافها على الشركة، وهي صالحة للاستعمال طالما أن التوقيع والختم الرسمي ظاهرين عليها لمدة شهر من تاريخه.",
      "fields": [
        {"key": "sig_hr_manager", "type": "signature", "label_en": "HR Manager", "label_ar": "مدير إدارة الموارد البشرية", "source": "submission"}
      ]
    }
  ]
}
$json$::jsonb, 'published', true),

-- ---------------------------------------------------------------------------
-- 4) Joining Letter
-- ---------------------------------------------------------------------------
('joining-letter', 'Joining Form', 'نموذج مباشرة العمل', 'onboarding', 'HR-FRM-004', 'HR', 1, '1', CURRENT_DATE, $json$
{
  "sections": [
    {
      "key": "employee",
      "title_en": "Employee Details",
      "title_ar": "بيانات الموظف",
      "fields": [
        {"key": "employee_full_name", "type": "text", "label_en": "Name", "label_ar": "الاسم", "source": "employee", "employee_field": "full_name_en", "required": true},
        {"key": "employee_no", "type": "text", "label_en": "Employee ID", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no"},
        {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"},
        {"key": "job_title", "type": "text", "label_en": "Job Title", "label_ar": "المسمى الوظيفي", "source": "employee", "employee_field": "job_title"},
        {"key": "sig_employee", "type": "signature", "label_en": "Employee Signature", "label_ar": "توقيع الموظف", "source": "submission"}
      ]
    },
    {
      "key": "department_use",
      "title_en": "For Department Use Only",
      "title_ar": "لاستخدام الإدارة فقط",
      "note_en": "This is to confirm that the above-mentioned employee started to work from the date below.",
      "note_ar": "نؤكد أن الموظف المذكور أعلاه باشر العمل اعتبارًا من التاريخ أدناه.",
      "fields": [
        {"key": "work_start_date", "type": "date", "label_en": "Started Work From", "label_ar": "باشر العمل من تاريخ", "source": "submission", "required": true},
        {"key": "sig_line_manager", "type": "signature", "label_en": "Line Manager", "label_ar": "المدير المباشر", "source": "submission"}
      ]
    },
    {
      "key": "hr_use",
      "title_en": "For HR Use Only",
      "title_ar": "لاستخدام الموارد البشرية فقط",
      "note_en": "Employee has been enrolled into payroll and entered in GOSI.",
      "note_ar": "تم إدراج الموظف في مسير الرواتب وتسجيله في التأمينات الاجتماعية.",
      "fields": [
        {"key": "sig_gosi", "type": "signature", "label_en": "GOSI", "label_ar": "التأمينات الاجتماعية", "source": "submission"},
        {"key": "sig_payroll", "type": "signature", "label_en": "Payroll", "label_ar": "الرواتب", "source": "submission"}
      ]
    },
    {
      "key": "cc",
      "title_en": "Copies",
      "title_ar": "نسخة إلى",
      "note_en": "Cc: Line Manager, Payroll, Employee File",
      "note_ar": "صورة إلى: المدير المباشر، قسم الرواتب، ملف الموظف",
      "fields": []
    }
  ]
}
$json$::jsonb, 'published', true),

-- ---------------------------------------------------------------------------
-- 5) Manpower Request Form
-- ---------------------------------------------------------------------------
('manpower-request', 'Manpower Request Form', 'طلب قوى عاملة', 'recruitment', 'HR-FRM-005', 'HR', 1, '1', CURRENT_DATE, $json$
{
  "sections": [
    {
      "key": "request",
      "title_en": "Request Details",
      "title_ar": "بيانات الطلب",
      "fields": [
        {"key": "reference_number", "type": "text", "label_en": "Reference Number", "label_ar": "الرقم المرجعي", "source": "submission"},
        {"key": "request_date", "type": "date", "label_en": "Date of Request", "label_ar": "تاريخ الطلب", "source": "submission", "required": true},
        {"key": "requestor_name", "type": "text", "label_en": "Requestor Name & Designation", "label_ar": "اسم مقدم الطلب ومسماه", "source": "submission", "required": true},
        {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "submission", "required": true},
        {"key": "location", "type": "text", "label_en": "Location", "label_ar": "الموقع", "source": "submission"},
        {"key": "reporting_to", "type": "text", "label_en": "Reporting To", "label_ar": "يرفع تقاريره إلى", "source": "submission"},
        {"key": "requested_position", "type": "radio", "label_en": "Requested Position", "label_ar": "الوظيفة المطلوبة", "source": "submission", "options": [
          {"value": "new", "label_en": "New", "label_ar": "جديدة"},
          {"value": "replacement", "label_en": "Replacement", "label_ar": "بديلة"}
        ]},
        {"key": "job_type", "type": "radio", "label_en": "Job Type", "label_ar": "نوع الوظيفة", "source": "submission", "options": [
          {"value": "permanent", "label_en": "Permanent", "label_ar": "دائمة"},
          {"value": "temporary", "label_en": "Temporary", "label_ar": "مؤقتة"}
        ]},
        {"key": "recruitment_type", "type": "radio", "label_en": "Recruitment Type", "label_ar": "نوع التوظيف", "source": "submission", "options": [
          {"value": "new", "label_en": "New", "label_ar": "جديد"},
          {"value": "transferrable", "label_en": "Transferrable", "label_ar": "نقل كفالة"}
        ]},
        {"key": "budgeted", "type": "radio", "label_en": "Budgeted", "label_ar": "ضمن الميزانية", "source": "submission", "options": [
          {"value": "yes", "label_en": "Yes", "label_ar": "نعم"},
          {"value": "no", "label_en": "No", "label_ar": "لا"}
        ]},
        {"key": "total_budget", "type": "currency", "label_en": "Total Budget", "label_ar": "إجمالي الميزانية", "source": "submission"},
        {"key": "expected_joining_date", "type": "date", "label_en": "Expected Joining Date", "label_ar": "تاريخ الالتحاق المتوقع", "source": "submission"}
      ]
    },
    {
      "key": "positions",
      "title_en": "Requested Positions",
      "title_ar": "الوظائف المطلوبة",
      "fields": [
        {"key": "positions_table", "type": "table", "label_en": "Positions", "label_ar": "الوظائف", "source": "submission", "min_rows": 1, "columns": [
          {"key": "designation", "type": "text", "label_en": "Designation", "label_ar": "المسمى"},
          {"key": "qualification", "type": "text", "label_en": "Qualification", "label_ar": "المؤهل"},
          {"key": "experience", "type": "text", "label_en": "Experience", "label_ar": "الخبرة"},
          {"key": "nationality", "type": "text", "label_en": "Nat.", "label_ar": "الجنسية"},
          {"key": "age", "type": "text", "label_en": "Age", "label_ar": "العمر"},
          {"key": "total_nos", "type": "number", "label_en": "Total Nos.", "label_ar": "العدد"},
          {"key": "salary", "type": "number", "label_en": "Salary", "label_ar": "الراتب"}
        ]},
        {"key": "justification", "type": "textarea", "label_en": "Justification", "label_ar": "المبررات", "source": "submission"}
      ]
    },
    {
      "key": "approvals",
      "title_en": "Approvals",
      "title_ar": "الاعتمادات",
      "fields": [
        {"key": "sig_requestor", "type": "signature", "label_en": "Requestor", "label_ar": "مقدم الطلب", "source": "submission"},
        {"key": "sig_hr_manager", "type": "signature", "label_en": "HR Manager", "label_ar": "مدير الموارد البشرية", "source": "submission"},
        {"key": "sig_head_dept", "type": "signature", "label_en": "Head of Dept.", "label_ar": "مدير الإدارة", "source": "submission"},
        {"key": "sig_ceo", "type": "signature", "label_en": "CEO", "label_ar": "الرئيس التنفيذي", "source": "submission"}
      ]
    }
  ]
}
$json$::jsonb, 'published', true),

-- ---------------------------------------------------------------------------
-- 6) Petty Cash Voucher
-- ---------------------------------------------------------------------------
('petty-cash-voucher', 'Petty Cash Voucher', 'سند عهدة نقدية', 'finance', 'HR-FRM-006', 'HR', 1, '1', CURRENT_DATE, $json$
{
  "sections": [
    {
      "key": "voucher",
      "title_en": "Voucher Details",
      "title_ar": "بيانات السند",
      "fields": [
        {"key": "voucher_no", "type": "text", "label_en": "Voucher No", "label_ar": "رقم السند", "source": "submission", "required": true},
        {"key": "voucher_date", "type": "date", "label_en": "Date", "label_ar": "التاريخ", "source": "submission", "required": true},
        {"key": "payable_to", "type": "text", "label_en": "Payable To", "label_ar": "يُصرف إلى", "source": "employee", "employee_field": "full_name_en", "required": true},
        {"key": "employee_no", "type": "text", "label_en": "Employee No.", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no"},
        {"key": "department", "type": "text", "label_en": "Dept.", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"}
      ]
    },
    {
      "key": "expenditure",
      "title_en": "Details and Purpose of Expenditure",
      "title_ar": "تفاصيل المصروفات والغرض منها",
      "fields": [
        {"key": "expense_items", "type": "table", "label_en": "Expense Items", "label_ar": "بنود المصروفات", "source": "submission", "min_rows": 1, "columns": [
          {"key": "particulars", "type": "text", "label_en": "Particulars", "label_ar": "البيان"},
          {"key": "bill_no", "type": "text", "label_en": "Bill #", "label_ar": "رقم الفاتورة"},
          {"key": "amount", "type": "number", "label_en": "Amount", "label_ar": "المبلغ"},
          {"key": "vat", "type": "number", "label_en": "VAT", "label_ar": "الضريبة"}
        ]},
        {"key": "total_amount", "type": "computed", "label_en": "Total Amount (SAR)", "label_ar": "إجمالي المبلغ (ر.س)", "source": "computed", "formula": "sum_table_columns(expense_items, amount, vat)", "format": "currency"}
      ]
    },
    {
      "key": "approvals",
      "title_en": "Approvals",
      "title_ar": "الاعتمادات",
      "fields": [
        {"key": "sig_prepared_by", "type": "signature", "label_en": "Prepared By", "label_ar": "أعده", "source": "submission"},
        {"key": "sig_reviewed_by", "type": "signature", "label_en": "Reviewed By", "label_ar": "راجعه", "source": "submission"},
        {"key": "sig_approved_by", "type": "signature", "label_en": "Approved By", "label_ar": "اعتمده", "source": "submission"}
      ]
    }
  ]
}
$json$::jsonb, 'published', true),

-- ---------------------------------------------------------------------------
-- 7) EOS (End of Service) Calculation
-- ---------------------------------------------------------------------------
('eos-calculation', 'EOS Calculation', 'حساب نهاية الخدمة', 'payroll', 'HR-FRM-007', 'HR', 1, '1', CURRENT_DATE, $json$
{
  "sections": [
    {
      "key": "personal",
      "title_en": "Personal Details",
      "title_ar": "البيانات الشخصية",
      "fields": [
        {"key": "employee_full_name", "type": "text", "label_en": "Name", "label_ar": "الاسم", "source": "employee", "employee_field": "full_name_en", "required": true},
        {"key": "employee_no", "type": "text", "label_en": "Employee ID", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no", "required": true},
        {"key": "job_title", "type": "text", "label_en": "Position", "label_ar": "الوظيفة", "source": "employee", "employee_field": "job_title"},
        {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"},
        {"key": "nationality", "type": "text", "label_en": "Nationality", "label_ar": "الجنسية", "source": "employee", "employee_field": "nationality"},
        {"key": "joining_date", "type": "date", "label_en": "Joining Date", "label_ar": "تاريخ الالتحاق", "source": "employee", "employee_field": "hire_date", "required": true},
        {"key": "last_working_date", "type": "date", "label_en": "Last Working Date", "label_ar": "آخر يوم عمل", "source": "submission", "required": true},
        {"key": "service_period", "type": "computed", "label_en": "Service Period", "label_ar": "مدة الخدمة", "source": "computed", "formula": "period_ymd(joining_date, last_working_date)"},
        {"key": "vacation_balance_days", "type": "number", "label_en": "Vacation Balance (days)", "label_ar": "رصيد الإجازات (أيام)", "source": "submission"},
        {"key": "separation_type", "type": "radio", "label_en": "Separation Type", "label_ar": "نوع انتهاء الخدمة", "source": "submission", "required": true, "options": [
          {"value": "resignation", "label_en": "Resignation", "label_ar": "استقالة"},
          {"value": "termination", "label_en": "Termination", "label_ar": "إنهاء عقد"}
        ]},
        {"key": "bank_name", "type": "text", "label_en": "Bank Name", "label_ar": "اسم البنك", "source": "employee", "employee_field": "bank_name"},
        {"key": "bank_account_no", "type": "text", "label_en": "Account No.", "label_ar": "رقم الحساب", "source": "employee", "employee_field": "bank_account_no"},
        {"key": "company_holdings", "type": "text", "label_en": "Company Holdings", "label_ar": "عهد الشركة", "source": "submission"}
      ]
    },
    {
      "key": "salary",
      "title_en": "Salary and Allowances",
      "title_ar": "الراتب والبدلات",
      "fields": [
        {"key": "basic_salary", "type": "currency", "label_en": "Basic Salary (SAR)", "label_ar": "الراتب الأساسي (ر.س)", "source": "employee", "employee_field": "base_salary", "required": true},
        {"key": "housing_allowance", "type": "currency", "label_en": "Housing Allowance (SAR)", "label_ar": "بدل السكن (ر.س)", "source": "employee", "employee_field": "housing_allowance"},
        {"key": "transport_allowance", "type": "currency", "label_en": "Transportation Allowance (SAR)", "label_ar": "بدل المواصلات (ر.س)", "source": "employee", "employee_field": "transport_allowance"},
        {"key": "phone_allowance", "type": "currency", "label_en": "Phone Allowance (SAR)", "label_ar": "بدل الهاتف (ر.س)", "source": "submission"},
        {"key": "education_allowance", "type": "currency", "label_en": "Education Allowance (SAR)", "label_ar": "بدل التعليم (ر.س)", "source": "submission"},
        {"key": "other_allowance", "type": "currency", "label_en": "Other Allowance (SAR)", "label_ar": "بدلات أخرى (ر.س)", "source": "submission"},
        {"key": "gross_pay", "type": "computed", "label_en": "Gross Pay (SAR)", "label_ar": "إجمالي الراتب (ر.س)", "source": "computed", "formula": "sum_fields(basic_salary, housing_allowance, transport_allowance, phone_allowance, education_allowance, other_allowance)", "format": "currency"}
      ]
    },
    {
      "key": "calculation",
      "title_en": "End of Service Calculation",
      "title_ar": "حساب مستحقات نهاية الخدمة",
      "note_en": "EOS gratuity per Saudi Labor Law: half a month's wage per year for the first five years, one month's wage per year thereafter. Resignation factor: <2 years = 0, 2-5 years = 1/3, 5-10 years = 2/3, 10+ years = full.",
      "note_ar": "مكافأة نهاية الخدمة وفق نظام العمل السعودي: نصف أجر شهر عن كل سنة من السنوات الخمس الأولى وأجر شهر كامل عن كل سنة بعدها. معامل الاستقالة: أقل من سنتين = 0، من 2-5 سنوات = الثلث، من 5-10 سنوات = الثلثان، 10 سنوات فأكثر = كاملة.",
      "fields": [
        {"key": "eos_gratuity", "type": "computed", "label_en": "End of Service Award (SAR)", "label_ar": "مكافأة نهاية الخدمة (ر.س)", "source": "computed", "formula": "eos_gratuity(joining_date, last_working_date, gross_pay, separation_type)", "format": "currency"},
        {"key": "annual_leave_payout", "type": "computed", "label_en": "Annual Leave Balance Payout (SAR)", "label_ar": "بدل رصيد الإجازات (ر.س)", "source": "computed", "formula": "leave_payout(gross_pay, vacation_balance_days)", "format": "currency"},
        {"key": "bonus_income", "type": "currency", "label_en": "Bonus (SAR)", "label_ar": "مكافآت (ر.س)", "source": "submission"},
        {"key": "other_income", "type": "currency", "label_en": "Other Income (SAR)", "label_ar": "مستحقات أخرى (ر.س)", "source": "submission"},
        {"key": "total_income", "type": "computed", "label_en": "Total Amount — Income (SAR)", "label_ar": "إجمالي المستحقات (ر.س)", "source": "computed", "formula": "sum_fields(eos_gratuity, annual_leave_payout, bonus_income, other_income)", "format": "currency"},
        {"key": "total_deductions", "type": "currency", "label_en": "Total Amount — Deductions (SAR)", "label_ar": "إجمالي الاستقطاعات (ر.س)", "source": "submission"},
        {"key": "net_due", "type": "computed", "label_en": "Total Amount Due (SAR)", "label_ar": "صافي المستحق (ر.س)", "source": "computed", "formula": "subtract(total_income, total_deductions)", "format": "currency"}
      ]
    },
    {
      "key": "approvals",
      "title_en": "Approvals",
      "title_ar": "الاعتمادات",
      "fields": [
        {"key": "sig_prepared_by", "type": "signature", "label_en": "Prepared By (HR)", "label_ar": "أعده (الموارد البشرية)", "source": "submission"},
        {"key": "sig_reviewed_by", "type": "signature", "label_en": "Reviewed By", "label_ar": "راجعه", "source": "submission"},
        {"key": "sig_verified_by", "type": "signature", "label_en": "Verified By (Finance)", "label_ar": "دققه (المالية)", "source": "submission"},
        {"key": "sig_approved_by", "type": "signature", "label_en": "Approved By (CEO)", "label_ar": "اعتمده (الرئيس التنفيذي)", "source": "submission"},
        {"key": "sig_received_by", "type": "signature", "label_en": "Received By (Employee)", "label_ar": "استلمه (الموظف)", "source": "submission"}
      ]
    }
  ]
}
$json$::jsonb, 'published', true),

-- ---------------------------------------------------------------------------
-- 8) Employee Performance Appraisal
-- ---------------------------------------------------------------------------
('performance-appraisal', 'Employee Performance Appraisal', 'تقييم أداء الموظف', 'performance', 'HR-FRM-008', 'HR', 1, '1', CURRENT_DATE, $json$
{
  "sections": [
    {
      "key": "employee_details",
      "title_en": "Employee Details",
      "title_ar": "بيانات الموظف",
      "fields": [
        {"key": "employee_full_name", "type": "text", "label_en": "Name of Staff", "label_ar": "اسم الموظف", "source": "employee", "employee_field": "full_name_en", "required": true},
        {"key": "employee_no", "type": "text", "label_en": "Badge ID No.", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no", "required": true},
        {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"},
        {"key": "location", "type": "text", "label_en": "Location", "label_ar": "الموقع", "source": "submission"},
        {"key": "date_of_employment", "type": "date", "label_en": "Date of Employment", "label_ar": "تاريخ التوظيف", "source": "employee", "employee_field": "hire_date"},
        {"key": "evaluation_period", "type": "text", "label_en": "Period of Evaluation", "label_ar": "فترة التقييم", "source": "submission", "required": true},
        {"key": "date_of_evaluation", "type": "date", "label_en": "Date of Evaluation", "label_ar": "تاريخ التقييم", "source": "submission", "required": true},
        {"key": "last_evaluation_date", "type": "date", "label_en": "Last Date of Evaluation", "label_ar": "تاريخ آخر تقييم", "source": "submission"}
      ]
    },
    {
      "key": "scores",
      "title_en": "Performance Categories",
      "title_ar": "فئات الأداء",
      "note_en": "Rating scale: Outstanding 90-100% · Exceeds Expectations 80-90% · Achieved Expectations 60-80% · Partially Meets Expectations 50-60% · Needs Improvement 10-50%.",
      "note_ar": "مقياس التقييم: متميز 90-100% · يفوق التوقعات 80-90% · حقق التوقعات 60-80% · يحقق التوقعات جزئيًا 50-60% · يحتاج إلى تحسين 10-50%.",
      "fields": [
        {"key": "score_attendance", "type": "number", "label_en": "Attendance & Punctuality (max 10)", "label_ar": "الحضور والالتزام بالمواعيد (10)", "source": "submission", "min": 0, "max": 10},
        {"key": "score_job_knowledge", "type": "number", "label_en": "Knowledge of Assigned Job (max 10)", "label_ar": "المعرفة بالوظيفة (10)", "source": "submission", "min": 0, "max": 10},
        {"key": "score_quality", "type": "number", "label_en": "Quality of Assigned Tasks (max 10)", "label_ar": "جودة المهام (10)", "source": "submission", "min": 0, "max": 10},
        {"key": "score_teamwork", "type": "number", "label_en": "Cooperation & Teamwork (max 10)", "label_ar": "التعاون والعمل الجماعي (10)", "source": "submission", "min": 0, "max": 10},
        {"key": "score_appearance", "type": "number", "label_en": "General Appearance (max 10)", "label_ar": "المظهر العام (10)", "source": "submission", "min": 0, "max": 10},
        {"key": "score_company_property", "type": "number", "label_en": "Company Property (max 10)", "label_ar": "ممتلكات الشركة (10)", "source": "submission", "min": 0, "max": 10},
        {"key": "score_reliability", "type": "number", "label_en": "Reliability (max 15)", "label_ar": "الاعتمادية (15)", "source": "submission", "min": 0, "max": 15},
        {"key": "score_confidentiality", "type": "number", "label_en": "Data Confidentiality (max 15)", "label_ar": "سرية المعلومات (15)", "source": "submission", "min": 0, "max": 15},
        {"key": "score_initiative", "type": "number", "label_en": "Initiative & Flexibility (max 10)", "label_ar": "المبادرة والمرونة (10)", "source": "submission", "min": 0, "max": 10},
        {"key": "total_score", "type": "computed", "label_en": "Total Score (out of 100)", "label_ar": "المجموع الكلي (من 100)", "source": "computed", "formula": "sum_fields(score_attendance, score_job_knowledge, score_quality, score_teamwork, score_appearance, score_company_property, score_reliability, score_confidentiality, score_initiative)"}
      ]
    },
    {
      "key": "comments",
      "title_en": "Comments",
      "title_ar": "الملاحظات",
      "fields": [
        {"key": "evaluator_comments", "type": "textarea", "label_en": "Evaluator Comments", "label_ar": "ملاحظات المقيّم", "source": "submission"},
        {"key": "employee_comments", "type": "textarea", "label_en": "Employee Comments", "label_ar": "ملاحظات الموظف", "source": "submission"}
      ]
    },
    {
      "key": "approvals",
      "title_en": "Approval Section",
      "title_ar": "قسم الاعتماد",
      "fields": [
        {"key": "sig_head_of_department", "type": "signature", "label_en": "Head of Department", "label_ar": "مدير الإدارة", "source": "submission"},
        {"key": "sig_hr_management", "type": "signature", "label_en": "HR Management", "label_ar": "إدارة الموارد البشرية", "source": "submission"}
      ]
    }
  ]
}
$json$::jsonb, 'published', true)

ON CONFLICT (slug, version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
