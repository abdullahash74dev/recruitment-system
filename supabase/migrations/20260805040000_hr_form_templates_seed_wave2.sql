-- HR Forms module: second seeding wave — the remaining 23 templates rebuilt
-- from the company's original form set (the original "HR Forms Register"
-- index form is intentionally not seeded: the in-app Forms Catalog is the
-- register). As with wave 1, legacy branding and hardcoded staff names are
-- stripped; branding renders from site_settings and signatories are fields.

INSERT INTO public.hr_form_templates
  (slug, title_en, title_ar, category, doc_no, department_owner, version, revision_no, revision_date, schema, status, is_system_seed)
VALUES

-- 9) Employee Bank Details
('employee-bank-details', 'Employee Bank Details', 'بيانات الحساب البنكي للموظف', 'payroll', 'HR-FRM-009', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "bank", "title_en": "Bank Account Details", "title_ar": "بيانات الحساب البنكي",
   "note_en": "In accordance with the conditions of employment, I give below details of my personal account so that my salary may be paid by direct credit transfer.",
   "note_ar": "وفقًا لشروط التوظيف، أُقدّم أدناه بيانات حسابي الشخصي ليتم إيداع راتبي فيه عن طريق التحويل المباشر.",
   "fields": [
    {"key": "employee_full_name", "type": "text", "label_en": "Name of Employee", "label_ar": "اسم الموظف", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "employee_no", "type": "text", "label_en": "Employee ID", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no"},
    {"key": "bank_name", "type": "text", "label_en": "Name of Bank", "label_ar": "اسم البنك", "source": "employee", "employee_field": "bank_name", "required": true},
    {"key": "branch_address", "type": "text", "label_en": "Address of Branch", "label_ar": "عنوان الفرع", "source": "submission"},
    {"key": "account_number", "type": "text", "label_en": "Account Number", "label_ar": "رقم الحساب", "source": "employee", "employee_field": "bank_account_no"},
    {"key": "iban", "type": "text", "label_en": "IBAN Number", "label_ar": "رقم الآيبان", "source": "employee", "employee_field": "bank_iban", "required": true},
    {"key": "sig_employee", "type": "signature", "label_en": "Signed (Employee)", "label_ar": "توقيع الموظف", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 10) Salary Bank Account Change Request
('bank-account-change', 'Bank A/C Change Request', 'طلب تغيير الحساب البنكي', 'payroll', 'HR-FRM-010', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "request", "title_en": "Salary Bank A/C Change Request", "title_ar": "طلب تغيير الحساب البنكي للراتب", "fields": [
    {"key": "employee_full_name", "type": "text", "label_en": "Employee Name", "label_ar": "اسم الموظف", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "employee_no", "type": "text", "label_en": "Emp No", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no", "required": true},
    {"key": "request_date", "type": "date", "label_en": "Date", "label_ar": "التاريخ", "source": "submission", "required": true},
    {"key": "clearance_letter", "type": "radio", "label_en": "Bank Clearance Letter", "label_ar": "خطاب مخالصة البنك", "source": "submission", "options": [
      {"value": "yes", "label_en": "Yes", "label_ar": "نعم"}, {"value": "no", "label_en": "No", "label_ar": "لا"}
    ]},
    {"key": "old_bank_name", "type": "text", "label_en": "Old Bank Name", "label_ar": "اسم البنك السابق", "source": "submission", "required": true},
    {"key": "old_iban", "type": "text", "label_en": "Old IBAN No.", "label_ar": "الآيبان السابق", "source": "submission"},
    {"key": "new_bank_name", "type": "text", "label_en": "New Bank Name", "label_ar": "اسم البنك الجديد", "source": "submission", "required": true},
    {"key": "new_iban", "type": "text", "label_en": "New IBAN No.", "label_ar": "الآيبان الجديد", "source": "submission", "required": true},
    {"key": "sig_requestor", "type": "signature", "label_en": "Requestor", "label_ar": "مقدم الطلب", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 11) Interview Evaluation
('interview-evaluation', 'Interview Evaluation Form', 'نموذج تقييم المقابلة', 'recruitment', 'HR-FRM-011', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "candidate", "title_en": "Candidate Details", "title_ar": "بيانات المرشح", "fields": [
    {"key": "candidate_name", "type": "text", "label_en": "Candidate Name", "label_ar": "اسم المرشح", "source": "submission", "required": true},
    {"key": "job_title", "type": "text", "label_en": "Job Title", "label_ar": "المسمى الوظيفي", "source": "submission", "required": true},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "submission"},
    {"key": "branch", "type": "text", "label_en": "Branch", "label_ar": "الفرع", "source": "submission"},
    {"key": "source_of_applicant", "type": "text", "label_en": "Source of Applicant", "label_ar": "مصدر المتقدم", "source": "submission"},
    {"key": "recruiter_name", "type": "text", "label_en": "Recruiter Name", "label_ar": "اسم مسؤول التوظيف", "source": "submission"}
  ]},
  {"key": "evaluation", "title_en": "Evaluation Factors", "title_ar": "عوامل التقييم", "fields": [
    {"key": "eval_appearance", "type": "radio", "label_en": "Appearance", "label_ar": "المظهر", "source": "submission", "options": [
      {"value": "very_good", "label_en": "Very Good", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "acceptable", "label_en": "Acceptable", "label_ar": "مقبول"}]},
    {"key": "eval_friendliness", "type": "radio", "label_en": "Friendliness", "label_ar": "الود واللباقة", "source": "submission", "options": [
      {"value": "very_good", "label_en": "Very Good", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "acceptable", "label_en": "Acceptable", "label_ar": "مقبول"}]},
    {"key": "eval_poise", "type": "radio", "label_en": "Poise / Stability", "label_ar": "الاتزان", "source": "submission", "options": [
      {"value": "very_good", "label_en": "Very Good", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "acceptable", "label_en": "Acceptable", "label_ar": "مقبول"}]},
    {"key": "eval_personality", "type": "radio", "label_en": "Personality", "label_ar": "الشخصية", "source": "submission", "options": [
      {"value": "very_good", "label_en": "Very Good", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "acceptable", "label_en": "Acceptable", "label_ar": "مقبول"}]},
    {"key": "eval_conversation", "type": "radio", "label_en": "Conversational Ability", "label_ar": "مهارة الحوار", "source": "submission", "options": [
      {"value": "very_good", "label_en": "Very Good", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "acceptable", "label_en": "Acceptable", "label_ar": "مقبول"}]},
    {"key": "eval_alertness", "type": "radio", "label_en": "Alertness", "label_ar": "سرعة البديهة", "source": "submission", "options": [
      {"value": "very_good", "label_en": "Very Good", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "acceptable", "label_en": "Acceptable", "label_ar": "مقبول"}]},
    {"key": "eval_field_knowledge", "type": "radio", "label_en": "Information About Work Field", "label_ar": "المعرفة بمجال العمل", "source": "submission", "options": [
      {"value": "very_good", "label_en": "Very Good", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "acceptable", "label_en": "Acceptable", "label_ar": "مقبول"}]},
    {"key": "eval_experience", "type": "radio", "label_en": "Experience", "label_ar": "الخبرة", "source": "submission", "options": [
      {"value": "very_good", "label_en": "Very Good", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "acceptable", "label_en": "Acceptable", "label_ar": "مقبول"}]},
    {"key": "eval_drive", "type": "radio", "label_en": "Drive & Ability to Learn", "label_ar": "الطموح والقابلية للتعلم", "source": "submission", "options": [
      {"value": "very_good", "label_en": "Very Good", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "acceptable", "label_en": "Acceptable", "label_ar": "مقبول"}]},
    {"key": "eval_pressure", "type": "radio", "label_en": "Work Under Pressure", "label_ar": "العمل تحت الضغط", "source": "submission", "options": [
      {"value": "very_good", "label_en": "Very Good", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "acceptable", "label_en": "Acceptable", "label_ar": "مقبول"}]}
  ]},
  {"key": "result", "title_en": "Result", "title_ar": "النتيجة", "fields": [
    {"key": "final_result", "type": "radio", "label_en": "Final Result", "label_ar": "النتيجة النهائية", "source": "submission", "required": true, "options": [
      {"value": "selected", "label_en": "Selected", "label_ar": "مقبول"},
      {"value": "future_opening", "label_en": "Future Opening", "label_ar": "لفرصة مستقبلية"},
      {"value": "rejected", "label_en": "Rejected", "label_ar": "مرفوض"}]},
    {"key": "remarks", "type": "textarea", "label_en": "Remarks", "label_ar": "ملاحظات", "source": "submission"},
    {"key": "sig_interviewer", "type": "signature", "label_en": "Interviewed By", "label_ar": "أجرى المقابلة", "source": "submission"},
    {"key": "sig_hr_manager", "type": "signature", "label_en": "Reviewed & Approved By (HR & Admin Manager)", "label_ar": "راجعه واعتمده (مدير الموارد البشرية والإدارة)", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 12) Payslip
('payslip', 'Payslip', 'قسيمة الراتب', 'payroll', 'HR-FRM-012', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "employee", "title_en": "Employee", "title_ar": "الموظف", "fields": [
    {"key": "employee_full_name", "type": "text", "label_en": "Employee Name", "label_ar": "اسم الموظف", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "employee_no", "type": "text", "label_en": "Employee ID", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no", "required": true},
    {"key": "designation", "type": "text", "label_en": "Designation", "label_ar": "المسمى", "source": "employee", "employee_field": "job_title"},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"},
    {"key": "date_of_joining", "type": "date", "label_en": "Date of Joining", "label_ar": "تاريخ الالتحاق", "source": "employee", "employee_field": "hire_date"},
    {"key": "pay_period", "type": "text", "label_en": "Pay Period", "label_ar": "فترة الراتب", "source": "submission", "required": true},
    {"key": "worked_days", "type": "number", "label_en": "Worked Days", "label_ar": "أيام العمل", "source": "submission"},
    {"key": "date_issue", "type": "date", "label_en": "Date of Issue", "label_ar": "تاريخ الإصدار", "source": "submission"}
  ]},
  {"key": "earnings", "title_en": "Earnings", "title_ar": "المستحقات", "fields": [
    {"key": "basic", "type": "currency", "label_en": "Basic", "label_ar": "الراتب الأساسي", "source": "employee", "employee_field": "base_salary"},
    {"key": "housing_allowance", "type": "currency", "label_en": "Housing Allowance", "label_ar": "بدل السكن", "source": "employee", "employee_field": "housing_allowance"},
    {"key": "transport_allowance", "type": "currency", "label_en": "Transportation Allowance", "label_ar": "بدل المواصلات", "source": "employee", "employee_field": "transport_allowance"},
    {"key": "food_allowance", "type": "currency", "label_en": "Food Allowance", "label_ar": "بدل الطعام", "source": "submission"},
    {"key": "other_allowance", "type": "currency", "label_en": "Other Allowance", "label_ar": "بدلات أخرى", "source": "submission"},
    {"key": "overtime", "type": "currency", "label_en": "Overtime", "label_ar": "العمل الإضافي", "source": "submission"},
    {"key": "shift_allowance", "type": "currency", "label_en": "Shift Allowance", "label_ar": "بدل الوردية", "source": "submission"},
    {"key": "reimburse", "type": "currency", "label_en": "Reimbursements", "label_ar": "مبالغ مستردة", "source": "submission"},
    {"key": "bonus", "type": "currency", "label_en": "Bonus", "label_ar": "مكافأة", "source": "submission"},
    {"key": "total_earnings", "type": "computed", "label_en": "Total Earnings", "label_ar": "إجمالي المستحقات", "source": "computed", "formula": "sum_fields(basic, housing_allowance, transport_allowance, food_allowance, other_allowance, overtime, shift_allowance, reimburse, bonus)", "format": "currency"}
  ]},
  {"key": "deductions", "title_en": "Deductions", "title_ar": "الاستقطاعات", "fields": [
    {"key": "gosi", "type": "currency", "label_en": "GOSI", "label_ar": "التأمينات الاجتماعية", "source": "submission"},
    {"key": "loan", "type": "currency", "label_en": "Loan", "label_ar": "قرض", "source": "submission"},
    {"key": "other_deduction", "type": "currency", "label_en": "Other", "label_ar": "أخرى", "source": "submission"},
    {"key": "total_deductions", "type": "computed", "label_en": "Total Deductions", "label_ar": "إجمالي الاستقطاعات", "source": "computed", "formula": "sum_fields(gosi, loan, other_deduction)", "format": "currency"},
    {"key": "net_pay", "type": "computed", "label_en": "Net Pay", "label_ar": "صافي الراتب", "source": "computed", "formula": "subtract(total_earnings, total_deductions)", "format": "currency"},
    {"key": "leave_balance", "type": "number", "label_en": "Leave Balance (days)", "label_ar": "رصيد الإجازات (أيام)", "source": "submission"}
  ]},
  {"key": "signatures", "title_en": "Signatures", "title_ar": "التواقيع", "fields": [
    {"key": "sig_employer", "type": "signature", "label_en": "Employer Signature", "label_ar": "توقيع صاحب العمل", "source": "submission"},
    {"key": "sig_employee", "type": "signature", "label_en": "Employee Signature", "label_ar": "توقيع الموظف", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 13) Payment Voucher
('payment-voucher', 'Payment Voucher', 'سند صرف', 'finance', 'HR-FRM-013', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "voucher", "title_en": "Payment Voucher", "title_ar": "سند صرف", "fields": [
    {"key": "voucher_no", "type": "text", "label_en": "No", "label_ar": "الرقم", "source": "submission", "required": true},
    {"key": "voucher_date", "type": "date", "label_en": "Date", "label_ar": "التاريخ", "source": "submission", "required": true},
    {"key": "amount", "type": "currency", "label_en": "Amount (SAR)", "label_ar": "المبلغ (ر.س)", "source": "submission", "required": true},
    {"key": "paid_from", "type": "text", "label_en": "Paid From", "label_ar": "يُصرف من", "source": "submission"},
    {"key": "sum_in_words", "type": "text", "label_en": "The Sum Of (in words)", "label_ar": "مبلغ وقدره (كتابةً)", "source": "submission"},
    {"key": "payment_method", "type": "radio", "label_en": "Cash / Cheque", "label_ar": "نقدًا / شيك", "source": "submission", "options": [
      {"value": "cash", "label_en": "Cash", "label_ar": "نقدًا"}, {"value": "cheque", "label_en": "Cheque", "label_ar": "شيك"}]},
    {"key": "cheque_no", "type": "text", "label_en": "Cheque No", "label_ar": "رقم الشيك", "source": "submission"},
    {"key": "bank", "type": "text", "label_en": "Bank", "label_ar": "البنك", "source": "submission"},
    {"key": "purpose", "type": "textarea", "label_en": "For", "label_ar": "وذلك عن", "source": "submission", "required": true}
  ]},
  {"key": "signatures", "title_en": "Signatures", "title_ar": "التواقيع", "fields": [
    {"key": "sig_received_by", "type": "signature", "label_en": "Cash Received By", "label_ar": "المستلم", "source": "submission"},
    {"key": "sig_paid_by", "type": "signature", "label_en": "Paid By", "label_ar": "الصارف", "source": "submission"},
    {"key": "sig_checked_by", "type": "signature", "label_en": "Checked By", "label_ar": "المدقق", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 14) Clearance Form
('clearance-form', 'Clearance Form', 'نموذج إخلاء طرف', 'offboarding', 'HR-FRM-014', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "personal", "title_en": "Personal Details", "title_ar": "البيانات الشخصية", "fields": [
    {"key": "employee_full_name", "type": "text", "label_en": "Name", "label_ar": "الاسم", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "employee_no", "type": "text", "label_en": "Employee ID", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no", "required": true},
    {"key": "job_title", "type": "text", "label_en": "Job Title", "label_ar": "المسمى الوظيفي", "source": "employee", "employee_field": "job_title"},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"},
    {"key": "nationality", "type": "text", "label_en": "Nationality", "label_ar": "الجنسية", "source": "employee", "employee_field": "nationality"},
    {"key": "line_manager", "type": "text", "label_en": "Line Manager", "label_ar": "المدير المباشر", "source": "submission"},
    {"key": "joining_date", "type": "date", "label_en": "Joining Date", "label_ar": "تاريخ الالتحاق", "source": "employee", "employee_field": "hire_date"},
    {"key": "last_working_date", "type": "date", "label_en": "Last Working Date", "label_ar": "آخر يوم عمل", "source": "submission", "required": true}
  ]},
  {"key": "clearances", "title_en": "Departmental Clearances", "title_ar": "إخلاء الطرف من الإدارات",
   "note_en": "Each department confirms the employee has returned all items and settled all obligations.",
   "note_ar": "تؤكد كل إدارة أن الموظف أعاد جميع العهد وسوّى جميع الالتزامات.",
   "fields": [
    {"key": "clearance_items", "type": "table", "label_en": "Clearance Items", "label_ar": "بنود الإخلاء", "source": "submission", "min_rows": 1, "columns": [
      {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة"},
      {"key": "cleared_by", "type": "text", "label_en": "Authorized By", "label_ar": "المسؤول"},
      {"key": "items", "type": "text", "label_en": "Items / Comments", "label_ar": "العهد / الملاحظات"},
      {"key": "date", "type": "text", "label_en": "Date", "label_ar": "التاريخ"},
      {"key": "remarks", "type": "text", "label_en": "Remarks", "label_ar": "ملاحظات"}
    ]}
  ]},
  {"key": "signatures", "title_en": "Sign-off", "title_ar": "الاعتماد", "fields": [
    {"key": "sig_employee", "type": "signature", "label_en": "Employee", "label_ar": "الموظف", "source": "submission"},
    {"key": "sig_hr_review", "type": "signature", "label_en": "Reviewed By (HR)", "label_ar": "راجعه (الموارد البشرية)", "source": "submission"},
    {"key": "sig_hr_approve", "type": "signature", "label_en": "Approved By (HR Manager)", "label_ar": "اعتمده (مدير الموارد البشرية)", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 15) Job Description
('job-description', 'Job Description', 'الوصف الوظيفي', 'general', 'HR-FRM-015', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "details", "title_en": "Job Details", "title_ar": "بيانات الوظيفة", "fields": [
    {"key": "position_title", "type": "text", "label_en": "Position Title", "label_ar": "المسمى الوظيفي", "source": "submission", "required": true},
    {"key": "grade", "type": "text", "label_en": "Grade", "label_ar": "الدرجة", "source": "submission"},
    {"key": "reports_to", "type": "text", "label_en": "Reports To", "label_ar": "يرفع تقاريره إلى", "source": "submission"},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "submission", "required": true},
    {"key": "job_function", "type": "text", "label_en": "Function", "label_ar": "الوظيفة التخصصية", "source": "submission"},
    {"key": "prepared_revision", "type": "text", "label_en": "Prepared By / Revision On", "label_ar": "أُعد بواسطة / تاريخ المراجعة", "source": "submission"}
  ]},
  {"key": "purpose", "title_en": "Job Purpose", "title_ar": "الغرض من الوظيفة", "fields": [
    {"key": "job_purpose", "type": "textarea", "label_en": "Job Purpose", "label_ar": "الغرض من الوظيفة", "source": "submission", "required": true}
  ]},
  {"key": "dimensions", "title_en": "Job Dimensions", "title_ar": "أبعاد الوظيفة", "fields": [
    {"key": "direct_reports", "type": "number", "label_en": "Staff Supervised — Direct Reports", "label_ar": "عدد المرؤوسين المباشرين", "source": "submission"},
    {"key": "total_staff", "type": "number", "label_en": "Staff Supervised — Total", "label_ar": "إجمالي المرؤوسين", "source": "submission"}
  ]},
  {"key": "accountability", "title_en": "Key Accountability", "title_ar": "المسؤوليات الرئيسية", "fields": [
    {"key": "key_accountability", "type": "textarea", "label_en": "Description", "label_ar": "الوصف", "source": "submission", "required": true}
  ]},
  {"key": "qualifications", "title_en": "Qualifications, Experience & Skills", "title_ar": "المؤهلات والخبرات والمهارات", "fields": [
    {"key": "qualifications", "type": "textarea", "label_en": "Skills, knowledge and experience required", "label_ar": "المهارات والمعارف والخبرات المطلوبة", "source": "submission"}
  ]},
  {"key": "competency", "title_en": "Competency (Behavioral)", "title_ar": "الجدارات السلوكية", "fields": [
    {"key": "competency", "type": "textarea", "label_en": "Behavioral Competence", "label_ar": "الجدارات السلوكية", "source": "submission"}
  ]},
  {"key": "approvals", "title_en": "Approvals", "title_ar": "الاعتمادات", "fields": [
    {"key": "sig_line_manager", "type": "signature", "label_en": "Line Manager (Dept. Manager)", "label_ar": "المدير المباشر (مدير الإدارة)", "source": "submission"},
    {"key": "sig_hr_manager", "type": "signature", "label_en": "Human Resources Manager", "label_ar": "مدير الموارد البشرية", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 16) Loan Acceptance Form
('loan-acceptance', 'Loan Acceptance Form', 'نموذج طلب قرض', 'payroll', 'HR-FRM-016', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "personal", "title_en": "Personal Details", "title_ar": "البيانات الشخصية", "fields": [
    {"key": "employee_full_name", "type": "text", "label_en": "Name", "label_ar": "الاسم", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "employee_no", "type": "text", "label_en": "Employee ID", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no"},
    {"key": "nationality", "type": "text", "label_en": "Nationality", "label_ar": "الجنسية", "source": "employee", "employee_field": "nationality"},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"},
    {"key": "job_title", "type": "text", "label_en": "Job Title", "label_ar": "المسمى الوظيفي", "source": "employee", "employee_field": "job_title"},
    {"key": "joining_date", "type": "date", "label_en": "Joining Date", "label_ar": "تاريخ الالتحاق", "source": "employee", "employee_field": "hire_date"}
  ]},
  {"key": "salary", "title_en": "Salary and Allowances", "title_ar": "الراتب والبدلات", "fields": [
    {"key": "basic_salary", "type": "currency", "label_en": "Basic Salary (SAR)", "label_ar": "الراتب الأساسي (ر.س)", "source": "employee", "employee_field": "base_salary"},
    {"key": "housing", "type": "currency", "label_en": "Housing (SAR)", "label_ar": "بدل السكن (ر.س)", "source": "employee", "employee_field": "housing_allowance"},
    {"key": "transport", "type": "currency", "label_en": "Transport (SAR)", "label_ar": "بدل المواصلات (ر.س)", "source": "employee", "employee_field": "transport_allowance"},
    {"key": "other_allowance", "type": "currency", "label_en": "Other Allowances (SAR)", "label_ar": "بدلات أخرى (ر.س)", "source": "submission"},
    {"key": "gross_pay", "type": "computed", "label_en": "Gross Pay (SAR)", "label_ar": "إجمالي الراتب (ر.س)", "source": "computed", "formula": "sum_fields(basic_salary, housing, transport, other_allowance)", "format": "currency"}
  ]},
  {"key": "loan", "title_en": "Loan Details", "title_ar": "بيانات القرض", "fields": [
    {"key": "loans_balance", "type": "currency", "label_en": "Existing Loans Balance (SAR)", "label_ar": "رصيد القروض القائمة (ر.س)", "source": "submission"},
    {"key": "loan_requirement", "type": "currency", "label_en": "Loan Requirement (SAR)", "label_ar": "قيمة القرض المطلوب (ر.س)", "source": "submission", "required": true},
    {"key": "months_of_installment", "type": "number", "label_en": "Months of Installment", "label_ar": "عدد أشهر السداد", "source": "submission", "required": true, "min": 1},
    {"key": "monthly_deduction", "type": "computed", "label_en": "Monthly Deduction (SAR)", "label_ar": "الاستقطاع الشهري (ر.س)", "source": "computed", "formula": "divide(loan_requirement, months_of_installment)", "format": "currency"},
    {"key": "reasons", "type": "textarea", "label_en": "Reasons", "label_ar": "الأسباب", "source": "submission", "required": true}
  ]},
  {"key": "approvals", "title_en": "Approvals", "title_ar": "الاعتمادات", "fields": [
    {"key": "sig_applicant", "type": "signature", "label_en": "Applicant", "label_ar": "مقدم الطلب", "source": "submission"},
    {"key": "sig_guarantor", "type": "signature", "label_en": "Guarantor", "label_ar": "الكفيل / الضامن", "source": "submission"},
    {"key": "hr_recommendation", "type": "textarea", "label_en": "HR Recommendation", "label_ar": "توصية الموارد البشرية", "source": "submission"},
    {"key": "sig_hr_director", "type": "signature", "label_en": "HR Director", "label_ar": "مدير إدارة الموارد البشرية", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 17) New Joiner Checklist
('new-joiner-checklist', 'New Joiner Checklist', 'قائمة تدقيق الموظف الجديد', 'onboarding', 'HR-FRM-017', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "personal", "title_en": "Personal Details", "title_ar": "البيانات الشخصية", "fields": [
    {"key": "employee_full_name", "type": "text", "label_en": "Name", "label_ar": "الاسم", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "employee_no", "type": "text", "label_en": "Employee ID", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no"},
    {"key": "position", "type": "text", "label_en": "Position", "label_ar": "الوظيفة", "source": "employee", "employee_field": "job_title"},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"},
    {"key": "start_date", "type": "date", "label_en": "Start Date", "label_ar": "تاريخ المباشرة", "source": "employee", "employee_field": "hire_date"},
    {"key": "reporting_manager", "type": "text", "label_en": "Reporting Manager", "label_ar": "المدير المباشر", "source": "submission"}
  ]},
  {"key": "documents", "title_en": "Onboarding Documents (Talent Acquisition)", "title_ar": "مستندات التعيين (استقطاب المواهب)", "fields": [
    {"key": "chk_interview_form", "type": "checkbox", "label_en": "Candidate Interview Form (HR / Direct Manager)", "label_ar": "نموذج مقابلة المرشح", "source": "submission"},
    {"key": "chk_cv", "type": "checkbox", "label_en": "Candidate Resume / CV", "label_ar": "السيرة الذاتية", "source": "submission"},
    {"key": "chk_certificates", "type": "checkbox", "label_en": "Education / Qualification & Experience Certificates (copies)", "label_ar": "شهادات المؤهلات والخبرة (نسخ)", "source": "submission"},
    {"key": "chk_id_copies", "type": "checkbox", "label_en": "ID / Iqama / Passport Copy (employee & family)", "label_ar": "نسخة الهوية / الإقامة / الجواز (الموظف والعائلة)", "source": "submission"},
    {"key": "chk_no_objection", "type": "checkbox", "label_en": "No Objection Letter", "label_ar": "خطاب عدم ممانعة", "source": "submission"},
    {"key": "chk_iqama_transfer", "type": "checkbox", "label_en": "Iqama Transfer Confirmation", "label_ar": "تأكيد نقل الكفالة", "source": "submission"},
    {"key": "chk_national_address", "type": "checkbox", "label_en": "National Address", "label_ar": "العنوان الوطني", "source": "submission"},
    {"key": "chk_gosi_print", "type": "checkbox", "label_en": "GOSI Print", "label_ar": "برنت التأمينات", "source": "submission"},
    {"key": "chk_clearance", "type": "checkbox", "label_en": "Clearance", "label_ar": "إخلاء طرف", "source": "submission"},
    {"key": "chk_driving_license", "type": "checkbox", "label_en": "Driving License Copy", "label_ar": "نسخة رخصة القيادة", "source": "submission"},
    {"key": "chk_medical_exam", "type": "checkbox", "label_en": "Medical Examination", "label_ar": "الفحص الطبي", "source": "submission"},
    {"key": "chk_background_check", "type": "checkbox", "label_en": "Background Check", "label_ar": "التحقق من الخلفية", "source": "submission"},
    {"key": "chk_reference_check", "type": "checkbox", "label_en": "Reference Check", "label_ar": "التحقق من المراجع", "source": "submission"},
    {"key": "chk_offer_signed", "type": "checkbox", "label_en": "Offer Letter Signed", "label_ar": "توقيع عرض العمل", "source": "submission"},
    {"key": "chk_employee_info", "type": "checkbox", "label_en": "Employee Information Form", "label_ar": "نموذج معلومات الموظف", "source": "submission"},
    {"key": "chk_bank_form", "type": "checkbox", "label_en": "Bank Account / IBAN Number Form", "label_ar": "نموذج الحساب البنكي / الآيبان", "source": "submission"},
    {"key": "chk_contract", "type": "checkbox", "label_en": "Contract", "label_ar": "العقد", "source": "submission"},
    {"key": "chk_health_passport", "type": "checkbox", "label_en": "Health Passport", "label_ar": "الجواز الصحي", "source": "submission"},
    {"key": "chk_declaration", "type": "checkbox", "label_en": "Declaration", "label_ar": "الإقرار", "source": "submission"},
    {"key": "chk_jd_signed", "type": "checkbox", "label_en": "Job Description Signed", "label_ar": "توقيع الوصف الوظيفي", "source": "submission"}
  ]},
  {"key": "signoff", "title_en": "Final Sign-off", "title_ar": "الاعتماد النهائي", "fields": [
    {"key": "sig_hr_coordinator", "type": "signature", "label_en": "HR Coordinator (file submitted to HRO)", "label_ar": "منسق الموارد البشرية (تسليم الملف للعمليات)", "source": "submission"},
    {"key": "sig_hro", "type": "signature", "label_en": "HR Operations (employee data entered, ID issued)", "label_ar": "عمليات الموارد البشرية (إدخال البيانات وإصدار الرقم)", "source": "submission"},
    {"key": "sig_gosi_enrollment", "type": "signature", "label_en": "HR Specialist (GOSI enrollment)", "label_ar": "أخصائي الموارد البشرية (تسجيل التأمينات)", "source": "submission"},
    {"key": "sig_medical_enrollment", "type": "signature", "label_en": "HR Coordinator (medical insurance enrollment)", "label_ar": "منسق الموارد البشرية (تسجيل التأمين الطبي)", "source": "submission"},
    {"key": "sig_archiving", "type": "signature", "label_en": "File Archived By", "label_ar": "أرشفة الملف بواسطة", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 18) Fixed-Term Employment Contract
('fixed-term-contract', 'Fixed-Term Employment Contract', 'عقد عمل محدد المدة', 'contracts', 'HR-FRM-018', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "contract", "title_en": "Contract", "title_ar": "العقد",
   "note_en": "This contract was entered into in the Kingdom of Saudi Arabia between the Company (the Employer) and the Employee named below. The Parties, having acknowledged their full legal capacity, agreed as follows.",
   "note_ar": "تم تحرير هذا العقد في المملكة العربية السعودية بين الشركة (صاحب العمل) والموظف المذكورة بياناته أدناه، وبعد أن أقر الطرفان بأهليتهما الكاملة المعتبرة شرعًا ونظامًا للتعاقد اتفقا على ما يلي.",
   "fields": [
    {"key": "contract_date", "type": "date", "label_en": "Contract Date", "label_ar": "تاريخ العقد", "source": "submission", "required": true},
    {"key": "employee_full_name", "type": "text", "label_en": "Employee Name", "label_ar": "اسم الموظف", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "nationality", "type": "text", "label_en": "Nationality", "label_ar": "الجنسية", "source": "employee", "employee_field": "nationality"},
    {"key": "passport_no", "type": "text", "label_en": "Passport No", "label_ar": "رقم جواز السفر", "source": "employee", "employee_field": "passport_no"},
    {"key": "iqama_no", "type": "text", "label_en": "Iqama / National ID No", "label_ar": "رقم الإقامة / الهوية", "source": "employee", "employee_field": "national_id"},
    {"key": "address", "type": "text", "label_en": "Address", "label_ar": "العنوان", "source": "submission"}
  ]},
  {"key": "terms", "title_en": "Position, Term & Compensation", "title_ar": "الوظيفة والمدة والأجر", "fields": [
    {"key": "position", "type": "text", "label_en": "Position", "label_ar": "الوظيفة", "source": "employee", "employee_field": "job_title", "required": true},
    {"key": "contract_years", "type": "number", "label_en": "Contract Period (years)", "label_ar": "مدة العقد (سنوات)", "source": "submission", "required": true},
    {"key": "start_date", "type": "date", "label_en": "Start Date", "label_ar": "تاريخ البدء", "source": "employee", "employee_field": "hire_date", "required": true},
    {"key": "probation_days", "type": "number", "label_en": "Probation Period (days)", "label_ar": "فترة التجربة (أيام)", "source": "submission"},
    {"key": "family_status", "type": "radio", "label_en": "Contractual Family Status", "label_ar": "الحالة الاجتماعية للتعاقد", "source": "submission", "options": [
      {"value": "married", "label_en": "Married", "label_ar": "متزوج"}, {"value": "single", "label_en": "Single", "label_ar": "أعزب"}]},
    {"key": "basic_salary", "type": "currency", "label_en": "Basic Salary (SAR)", "label_ar": "الراتب الأساسي (ر.س)", "source": "employee", "employee_field": "base_salary", "required": true},
    {"key": "housing_allowance", "type": "currency", "label_en": "Housing Allowance (SAR)", "label_ar": "بدل السكن (ر.س)", "source": "employee", "employee_field": "housing_allowance"},
    {"key": "transport_allowance", "type": "currency", "label_en": "Transportation Allowance (SAR)", "label_ar": "بدل المواصلات (ر.س)", "source": "employee", "employee_field": "transport_allowance"},
    {"key": "total_package", "type": "computed", "label_en": "Total Monthly Package (SAR)", "label_ar": "إجمالي الأجر الشهري (ر.س)", "source": "computed", "formula": "sum_fields(basic_salary, housing_allowance, transport_allowance)", "format": "currency"},
    {"key": "annual_leave_days", "type": "number", "label_en": "Annual Leave (days)", "label_ar": "الإجازة السنوية (أيام)", "source": "submission"}
  ]},
  {"key": "clauses", "title_en": "Standard Clauses", "title_ar": "البنود القياسية",
   "note_en": "The contract renews automatically for similar period(s) unless either party notifies otherwise in writing. The Employer provides health care coverage per the Cooperative Health Insurance Law. Working hours and weekly rest follow the Saudi Labor Law; the Employer may relocate the Employee to any of its work locations. Government fees are borne per the applicable regulations. Air tickets (non-Saudis) are provided per company policy. The contract ends on expiry of its term, by mutual written consent, or per Articles 74/80/81 of the Labor Law. The Employee shall comply with all Employer regulations, work rules and QHSE requirements, and maintain confidentiality of all Employer information. Any matters not addressed here are subject to the Saudi Labor Law.",
   "note_ar": "يتجدد العقد تلقائيًا لمدة أو لمدد مماثلة ما لم يُشعر أحد الطرفين الآخر كتابيًا بخلاف ذلك. يوفر صاحب العمل تغطية الرعاية الصحية وفق نظام الضمان الصحي التعاوني. تخضع ساعات العمل والراحة الأسبوعية لنظام العمل السعودي، ويحق لصاحب العمل نقل الموظف إلى أي من مواقع عمله. تُتحمل الرسوم الحكومية وفق الأنظمة السارية. تُؤمَّن تذاكر السفر (لغير السعوديين) وفق سياسة الشركة. ينتهي العقد بانتهاء مدته أو باتفاق الطرفين كتابيًا أو وفق المواد 74/80/81 من نظام العمل. يلتزم الموظف بجميع أنظمة ولوائح صاحب العمل ومتطلبات الجودة والصحة والسلامة والبيئة وبالمحافظة على سرية معلومات صاحب العمل. وما لم يرد به نص في هذا العقد يخضع لنظام العمل السعودي.",
   "fields": [
    {"key": "additional_terms", "type": "textarea", "label_en": "Additional / Special Terms", "label_ar": "بنود إضافية / خاصة", "source": "submission"}
  ]},
  {"key": "signatures", "title_en": "Signatures", "title_ar": "التواقيع", "fields": [
    {"key": "sig_employer", "type": "signature", "label_en": "First Party (Employer)", "label_ar": "الطرف الأول (صاحب العمل)", "source": "submission"},
    {"key": "sig_employee", "type": "signature", "label_en": "Second Party (Employee)", "label_ar": "الطرف الثاني (الموظف)", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 19) Consulting Services Contract
('consulting-services-contract', 'Consulting Services Contract', 'عقد خدمات استشارية', 'contracts', 'HR-FRM-019', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "parties", "title_en": "Parties", "title_ar": "الأطراف",
   "note_en": "This contract is between the Company (First Party) and the Consultant named below (Second Party). Both parties acknowledged their full legal capacity to contract.",
   "note_ar": "حُرر هذا العقد بين الشركة (الطرف الأول) والاستشاري المذكورة بياناته أدناه (الطرف الثاني)، بعد أن أقر الطرفان بأهليتهما الكاملة المعتبرة شرعًا ونظامًا للتعاقد.",
   "fields": [
    {"key": "contract_date", "type": "date", "label_en": "Contract Date", "label_ar": "تاريخ العقد", "source": "submission", "required": true},
    {"key": "consultant_name", "type": "text", "label_en": "Consultant Name", "label_ar": "اسم الاستشاري", "source": "submission", "required": true},
    {"key": "consultant_nationality", "type": "text", "label_en": "Nationality", "label_ar": "الجنسية", "source": "submission"},
    {"key": "consultant_id", "type": "text", "label_en": "ID No. / Source / Expiry", "label_ar": "رقم الهوية / مصدرها / تاريخ الانتهاء", "source": "submission"},
    {"key": "national_address", "type": "text", "label_en": "National Address", "label_ar": "العنوان الوطني", "source": "submission"},
    {"key": "contact_numbers", "type": "text", "label_en": "Contact Numbers", "label_ar": "أرقام التواصل", "source": "submission"},
    {"key": "email", "type": "text", "label_en": "E-mail", "label_ar": "البريد الإلكتروني", "source": "submission"}
  ]},
  {"key": "scope", "title_en": "Scope, Duration & Fees", "title_ar": "النطاق والمدة والأتعاب", "fields": [
    {"key": "service_field", "type": "text", "label_en": "Consulting Field", "label_ar": "مجال الاستشارة", "source": "submission", "required": true},
    {"key": "service_city", "type": "text", "label_en": "Service Location (City)", "label_ar": "مكان تقديم الخدمة (المدينة)", "source": "submission"},
    {"key": "start_date", "type": "date", "label_en": "Start Date", "label_ar": "تاريخ البدء", "source": "submission", "required": true},
    {"key": "end_date", "type": "date", "label_en": "End Date", "label_ar": "تاريخ الانتهاء", "source": "submission", "required": true},
    {"key": "monthly_fee", "type": "currency", "label_en": "Monthly Fee (SAR)", "label_ar": "الأتعاب الشهرية (ر.س)", "source": "submission", "required": true},
    {"key": "scope_details", "type": "textarea", "label_en": "Scope of Services (obligations of the Second Party)", "label_ar": "نطاق الخدمات (التزامات الطرف الثاني)", "source": "submission", "required": true}
  ]},
  {"key": "clauses", "title_en": "Standard Clauses", "title_ar": "البنود القياسية",
   "note_en": "This is not an employment contract; the Consultant provides services independently and the relationship is not subject to the Saudi Labor Law. The contract may be terminated by mutual written agreement, or by either party with 30 days written notice, or upon breach by the Second Party. Government fees and taxes are borne by the Second Party. The Consultant undertakes to keep all trade secrets and confidential information strictly confidential during and after the contract. Disputes are resolved by the competent authorities under the laws of the Kingdom of Saudi Arabia; the Gregorian calendar applies. This contract supersedes all prior agreements and is issued in two counterparts, one for each party.",
   "note_ar": "لا يُعد هذا العقد عقد عمل، ويقدم الاستشاري خدماته بشكل مستقل ولا تخضع العلاقة لأحكام نظام العمل السعودي. يجوز إنهاء العقد باتفاق الطرفين كتابيًا، أو بإشعار كتابي من أي طرف قبل 30 يومًا، أو عند إخلال الطرف الثاني بالتزاماته. يتحمل الطرف الثاني كافة الرسوم والضرائب الحكومية. يتعهد الاستشاري بالمحافظة التامة على الأسرار التجارية والمعلومات السرية أثناء العقد وبعده. يُفصل في أي نزاع لدى الجهات المختصة وفق أنظمة المملكة العربية السعودية ويُتبع التقويم الميلادي. يلغي هذا العقد كل ما سبقه من اتفاقيات، وحُرر من نسختين بيد كل طرف نسخة.",
   "fields": [
    {"key": "additional_terms", "type": "textarea", "label_en": "Additional Terms", "label_ar": "بنود إضافية", "source": "submission"}
  ]},
  {"key": "signatures", "title_en": "Signatures", "title_ar": "التواقيع", "fields": [
    {"key": "sig_first_party", "type": "signature", "label_en": "First Party (Company)", "label_ar": "الطرف الأول (الشركة)", "source": "submission"},
    {"key": "sig_second_party", "type": "signature", "label_en": "Second Party (Consultant)", "label_ar": "الطرف الثاني (الاستشاري)", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 20) Employment Offer
('employment-offer', 'Employment Offer', 'عرض عمل', 'recruitment', 'HR-FRM-020', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "offer", "title_en": "Offer", "title_ar": "العرض",
   "note_en": "It is with great pleasure that we are able to offer you a position at the Company as detailed below. If you agree with this offer, please sign and return it to us.",
   "note_ar": "يسرنا أن نقدم لكم عرض عمل لدى الشركة وفق التفاصيل أدناه. في حال موافقتكم على هذا العرض نأمل التوقيع أدناه وإعادته إلينا.",
   "fields": [
    {"key": "offer_date", "type": "date", "label_en": "Date", "label_ar": "التاريخ", "source": "submission", "required": true},
    {"key": "candidate_name", "type": "text", "label_en": "To (Candidate Name)", "label_ar": "إلى (اسم المرشح)", "source": "submission", "required": true},
    {"key": "position", "type": "text", "label_en": "Position", "label_ar": "الوظيفة", "source": "submission", "required": true},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "submission"},
    {"key": "probation_days", "type": "number", "label_en": "Probation Period (days)", "label_ar": "فترة التجربة (أيام)", "source": "submission"},
    {"key": "contract_period", "type": "text", "label_en": "Contract Period", "label_ar": "مدة العقد", "source": "submission"},
    {"key": "basic_salary", "type": "currency", "label_en": "Basic Salary (SAR)", "label_ar": "الراتب الأساسي (ر.س)", "source": "submission", "required": true},
    {"key": "housing_allowance", "type": "currency", "label_en": "Housing Allowance (SAR)", "label_ar": "بدل السكن (ر.س)", "source": "submission"},
    {"key": "transport_allowance", "type": "currency", "label_en": "Transportation (SAR)", "label_ar": "بدل المواصلات (ر.س)", "source": "submission"},
    {"key": "total_package", "type": "computed", "label_en": "Total Monthly Package (SAR)", "label_ar": "إجمالي الراتب الشهري (ر.س)", "source": "computed", "formula": "sum_fields(basic_salary, housing_allowance, transport_allowance)", "format": "currency"},
    {"key": "vacation_days", "type": "number", "label_en": "Vacation Days", "label_ar": "أيام الإجازة", "source": "submission"},
    {"key": "medical", "type": "text", "label_en": "Medical", "label_ar": "التأمين الطبي", "source": "submission", "placeholder_en": "As per company policy"},
    {"key": "offer_validity", "type": "text", "label_en": "Validity of This Offer", "label_ar": "مدة سريان العرض", "source": "submission", "placeholder_en": "3 working days"},
    {"key": "remarks", "type": "textarea", "label_en": "Remarks", "label_ar": "ملاحظات", "source": "submission", "placeholder_en": "All other terms per Saudi Labor Law & company policy"}
  ]},
  {"key": "acceptance", "title_en": "Acceptance", "title_ar": "القبول", "fields": [
    {"key": "effective_date", "type": "date", "label_en": "Effective Date", "label_ar": "تاريخ المباشرة", "source": "submission"},
    {"key": "sig_candidate", "type": "signature", "label_en": "Employment Offer Acceptance (Candidate)", "label_ar": "قبول عرض العمل (المرشح)", "source": "submission"},
    {"key": "sig_hr_manager", "type": "signature", "label_en": "HR Manager", "label_ar": "مدير الموارد البشرية", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 21) Probationary Period Extension
('probation-extension', 'Probationary Period Extension', 'تمديد فترة التجربة', 'contracts', 'HR-FRM-021', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "letter", "title_en": "Letter", "title_ar": "الخطاب",
   "note_en": "Reference to the employment contract signed with the Company, and based on business requirements and performance review, the probationary period is extended as detailed below, per the Saudi Labor Law.",
   "note_ar": "إشارة إلى عقد العمل الموقع مع الشركة، وبناءً على متطلبات العمل ومراجعة الأداء، تُمدد فترة التجربة وفق التفاصيل أدناه بما يتفق مع نظام العمل السعودي.",
   "fields": [
    {"key": "letter_date", "type": "date", "label_en": "Date", "label_ar": "التاريخ", "source": "submission", "required": true},
    {"key": "employee_full_name", "type": "text", "label_en": "To (Employee)", "label_ar": "إلى (الموظف)", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "position", "type": "text", "label_en": "Position", "label_ar": "المسمى الوظيفي", "source": "employee", "employee_field": "job_title"},
    {"key": "national_id", "type": "text", "label_en": "ID #", "label_ar": "رقم الهوية", "source": "employee", "employee_field": "national_id"},
    {"key": "contract_date", "type": "date", "label_en": "Original Contract Date", "label_ar": "تاريخ العقد الأصلي", "source": "employee", "employee_field": "hire_date"},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"},
    {"key": "extension_days", "type": "number", "label_en": "Extension Period (days)", "label_ar": "مدة التمديد (أيام)", "source": "submission", "required": true},
    {"key": "new_end_date", "type": "date", "label_en": "New Probation End Date", "label_ar": "التاريخ الجديد لانتهاء التجربة", "source": "submission", "required": true}
  ]},
  {"key": "acknowledgment", "title_en": "Employee Acknowledgment", "title_ar": "إقرار الموظف",
   "note_en": "I confirm hereby my agreement to extend my probationary period as stated above.",
   "note_ar": "أقر بموافقتي على تمديد فترة التجربة الخاصة بي كما هو مبين أعلاه.",
   "fields": [
    {"key": "sig_employee", "type": "signature", "label_en": "Employee", "label_ar": "الموظف", "source": "submission"},
    {"key": "sig_hr_manager", "type": "signature", "label_en": "HR Manager", "label_ar": "مدير الموارد البشرية", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 22) Violation Investigation Request
('violation-investigation', 'Violation Investigation Request', 'طلب تحقيق في مخالفة', 'general', 'HR-FRM-022', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "employee", "title_en": "Employee", "title_ar": "الموظف", "fields": [
    {"key": "employee_full_name", "type": "text", "label_en": "Employee Name", "label_ar": "اسم الموظف", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "employee_no", "type": "text", "label_en": "Employee ID", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no"},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"},
    {"key": "job_title", "type": "text", "label_en": "Job Title", "label_ar": "المسمى الوظيفي", "source": "employee", "employee_field": "job_title"}
  ]},
  {"key": "violation", "title_en": "Violation Details", "title_ar": "تفاصيل المخالفة", "fields": [
    {"key": "violation_date", "type": "date", "label_en": "Violation Date", "label_ar": "تاريخ المخالفة", "source": "submission", "required": true},
    {"key": "violation_description", "type": "textarea", "label_en": "Description of the Violation", "label_ar": "وصف المخالفة", "source": "submission", "required": true},
    {"key": "requested_by", "type": "text", "label_en": "Investigation Requested By", "label_ar": "طالب التحقيق", "source": "submission", "required": true}
  ]},
  {"key": "investigation", "title_en": "Investigation", "title_ar": "التحقيق", "fields": [
    {"key": "employee_statement", "type": "textarea", "label_en": "Employee Statement", "label_ar": "إفادة الموظف", "source": "submission"},
    {"key": "findings", "type": "textarea", "label_en": "Investigation Findings", "label_ar": "نتائج التحقيق", "source": "submission"},
    {"key": "decision", "type": "radio", "label_en": "Decision", "label_ar": "القرار", "source": "submission", "options": [
      {"value": "no_action", "label_en": "No Action", "label_ar": "حفظ التحقيق"},
      {"value": "verbal_warning", "label_en": "Verbal Warning", "label_ar": "إنذار شفهي"},
      {"value": "written_warning", "label_en": "Written Warning", "label_ar": "إنذار كتابي"},
      {"value": "salary_deduction", "label_en": "Salary Deduction", "label_ar": "حسم من الراتب"},
      {"value": "termination", "label_en": "Termination", "label_ar": "إنهاء الخدمة"}]},
    {"key": "decision_details", "type": "textarea", "label_en": "Decision Details", "label_ar": "تفاصيل القرار", "source": "submission"}
  ]},
  {"key": "signatures", "title_en": "Signatures", "title_ar": "التواقيع", "fields": [
    {"key": "sig_investigator", "type": "signature", "label_en": "Investigator", "label_ar": "المحقق", "source": "submission"},
    {"key": "sig_employee", "type": "signature", "label_en": "Employee", "label_ar": "الموظف", "source": "submission"},
    {"key": "sig_hr_manager", "type": "signature", "label_en": "HR Manager", "label_ar": "مدير الموارد البشرية", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 23) Clearance Certificate
('clearance-certificate', 'Clearance Certificate', 'شهادة إخلاء طرف', 'letters', 'HR-FRM-023', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "certificate", "title_en": "Certificate", "title_ar": "الشهادة",
   "note_en": "The Company certifies that the employee whose details appear below was one of its employees and has cleared all obligations and returned all company property, with no dues owed by either party.",
   "note_ar": "تشهد الشركة بأن الموظف المذكورة بياناته أدناه كان أحد موظفيها وقد أخلى طرفه من جميع الالتزامات وأعاد جميع عهد الشركة، ولا توجد أي مستحقات لأي من الطرفين.",
   "fields": [
    {"key": "certificate_date", "type": "date", "label_en": "Date", "label_ar": "التاريخ", "source": "submission", "required": true},
    {"key": "employee_full_name", "type": "text", "label_en": "Employee Name", "label_ar": "اسم الموظف", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "national_id", "type": "text", "label_en": "ID / Iqama No.", "label_ar": "رقم الهوية / الإقامة", "source": "employee", "employee_field": "national_id"},
    {"key": "nationality", "type": "text", "label_en": "Nationality", "label_ar": "الجنسية", "source": "employee", "employee_field": "nationality"},
    {"key": "position", "type": "text", "label_en": "Position", "label_ar": "الوظيفة", "source": "employee", "employee_field": "job_title"},
    {"key": "employment_from", "type": "date", "label_en": "Employed From", "label_ar": "تاريخ بداية الخدمة", "source": "employee", "employee_field": "hire_date"},
    {"key": "employment_to", "type": "date", "label_en": "Employed To", "label_ar": "تاريخ نهاية الخدمة", "source": "submission", "required": true},
    {"key": "sig_hr", "type": "signature", "label_en": "Human Resources Management", "label_ar": "إدارة الموارد البشرية", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 24) Experience Certificate
('experience-certificate', 'Experience Certificate', 'شهادة خبرة', 'letters', 'HR-FRM-024', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "certificate", "title_en": "Certificate", "title_ar": "الشهادة",
   "note_en": "The Company certifies that the employee named below worked for it in the position and period stated. This certificate is issued upon the employee's request without any responsibility on the company's part. We wish them all the best in their career.",
   "note_ar": "تشهد الشركة بأن الموظف المذكور أدناه عمل لديها بالوظيفة وللمدة المبينة. وقد أُعطي هذه الشهادة بناءً على طلبه دون أدنى مسؤولية على الشركة، ونتمنى له التوفيق في حياته المهنية.",
   "fields": [
    {"key": "certificate_date", "type": "date", "label_en": "Date", "label_ar": "التاريخ", "source": "submission", "required": true},
    {"key": "employee_full_name", "type": "text", "label_en": "Employee Name", "label_ar": "اسم الموظف", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "nationality", "type": "text", "label_en": "Nationality", "label_ar": "الجنسية", "source": "employee", "employee_field": "nationality"},
    {"key": "national_id", "type": "text", "label_en": "National ID / Iqama", "label_ar": "رقم الهوية / الإقامة", "source": "employee", "employee_field": "national_id"},
    {"key": "position", "type": "text", "label_en": "Position", "label_ar": "الوظيفة", "source": "employee", "employee_field": "job_title"},
    {"key": "from_date", "type": "date", "label_en": "From", "label_ar": "من تاريخ", "source": "employee", "employee_field": "hire_date"},
    {"key": "to_date", "type": "date", "label_en": "To", "label_ar": "إلى تاريخ", "source": "submission", "required": true},
    {"key": "sig_hr", "type": "signature", "label_en": "Human Resources Management", "label_ar": "إدارة الموارد البشرية", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 25) Salary Adjustment Form
('salary-adjustment', 'Salary Adjustment Form', 'نموذج تعديل الراتب', 'payroll', 'HR-FRM-025', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "employee", "title_en": "Employee Information", "title_ar": "بيانات الموظف", "fields": [
    {"key": "request_date", "type": "date", "label_en": "Date", "label_ar": "التاريخ", "source": "submission", "required": true},
    {"key": "employee_full_name", "type": "text", "label_en": "Name", "label_ar": "الاسم", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "employee_no", "type": "text", "label_en": "ID No", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no", "required": true},
    {"key": "joining_date", "type": "date", "label_en": "Joining Date", "label_ar": "تاريخ الالتحاق", "source": "employee", "employee_field": "hire_date"},
    {"key": "nationality", "type": "text", "label_en": "Nationality", "label_ar": "الجنسية", "source": "employee", "employee_field": "nationality"},
    {"key": "division", "type": "text", "label_en": "Division", "label_ar": "الإدارة العامة", "source": "submission"},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "القسم", "source": "employee", "employee_field": "department"},
    {"key": "project", "type": "text", "label_en": "Project", "label_ar": "المشروع", "source": "submission"},
    {"key": "city", "type": "text", "label_en": "City", "label_ar": "المدينة", "source": "submission"}
  ]},
  {"key": "adjustment", "title_en": "Requested Adjustment", "title_ar": "التعديل المطلوب", "fields": [
    {"key": "adjustment_type", "type": "radio", "label_en": "Adjustment Type", "label_ar": "نوع التعديل", "source": "submission", "required": true, "options": [
      {"value": "increment", "label_en": "Salary Increment", "label_ar": "زيادة اعتيادية"},
      {"value": "promotion", "label_en": "Promotion", "label_ar": "ترقية"},
      {"value": "internal_transfer", "label_en": "Internal Transfer", "label_ar": "تنقل داخلي"}]},
    {"key": "adjustment_items", "type": "table", "label_en": "Present vs Revised", "label_ar": "الوضع الحالي مقابل التعديل", "source": "submission", "min_rows": 1, "columns": [
      {"key": "item", "type": "text", "label_en": "Item (job title, grade, basic salary, allowance...)", "label_ar": "البند (المسمى، الدرجة، الراتب، البدل...)"},
      {"key": "present", "type": "text", "label_en": "Present", "label_ar": "الوضع الحالي"},
      {"key": "revised", "type": "text", "label_en": "Revised", "label_ar": "بعد التعديل"}
    ]},
    {"key": "effective_date", "type": "date", "label_en": "Effective Date of Change", "label_ar": "تاريخ بداية التعديل", "source": "submission", "required": true},
    {"key": "justification", "type": "textarea", "label_en": "Justification / Remarks", "label_ar": "أسباب التعديل / ملاحظات", "source": "submission", "required": true}
  ]},
  {"key": "approvals", "title_en": "Approvals", "title_ar": "الاعتمادات", "fields": [
    {"key": "sig_employee", "type": "signature", "label_en": "Employee", "label_ar": "الموظف", "source": "submission"},
    {"key": "sig_direct_manager", "type": "signature", "label_en": "Direct Manager", "label_ar": "المدير المباشر", "source": "submission"},
    {"key": "sig_hr_manager", "type": "signature", "label_en": "HR Manager", "label_ar": "مدير الموارد البشرية", "source": "submission"},
    {"key": "sig_ceo", "type": "signature", "label_en": "CEO", "label_ar": "الرئيس التنفيذي", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 26) Training Plan
('training-plan', 'Training Plan', 'خطة التدريب', 'training', 'HR-FRM-026', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "plan", "title_en": "Training Plan", "title_ar": "خطة التدريب", "fields": [
    {"key": "plan_year", "type": "text", "label_en": "Year", "label_ar": "السنة", "source": "submission", "required": true},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "submission"},
    {"key": "courses", "type": "table", "label_en": "Planned Courses", "label_ar": "الدورات المخططة", "source": "submission", "min_rows": 1, "columns": [
      {"key": "course", "type": "text", "label_en": "Course Title", "label_ar": "اسم الدورة"},
      {"key": "provider", "type": "text", "label_en": "Provider", "label_ar": "الجهة المقدمة"},
      {"key": "target_group", "type": "text", "label_en": "Target Group", "label_ar": "الفئة المستهدفة"},
      {"key": "planned_date", "type": "text", "label_en": "Planned Date", "label_ar": "التاريخ المخطط"},
      {"key": "duration", "type": "text", "label_en": "Duration", "label_ar": "المدة"},
      {"key": "cost", "type": "number", "label_en": "Cost (SAR)", "label_ar": "التكلفة (ر.س)"}
    ]},
    {"key": "total_cost", "type": "computed", "label_en": "Total Cost (SAR)", "label_ar": "إجمالي التكلفة (ر.س)", "source": "computed", "formula": "sum_table_columns(courses, cost)", "format": "currency"}
  ]},
  {"key": "approvals", "title_en": "Approvals", "title_ar": "الاعتمادات", "fields": [
    {"key": "sig_prepared_by", "type": "signature", "label_en": "Prepared By", "label_ar": "أعدها", "source": "submission"},
    {"key": "sig_approved_by", "type": "signature", "label_en": "Approved By", "label_ar": "اعتمدها", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 27) Training Evaluation
('training-evaluation', 'Training Evaluation', 'تقييم التدريب', 'training', 'HR-FRM-027', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "course", "title_en": "Course Details", "title_ar": "بيانات الدورة", "fields": [
    {"key": "employee_full_name", "type": "text", "label_en": "Trainee Name", "label_ar": "اسم المتدرب", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"},
    {"key": "course_title", "type": "text", "label_en": "Course Title", "label_ar": "اسم الدورة", "source": "submission", "required": true},
    {"key": "provider", "type": "text", "label_en": "Training Provider", "label_ar": "الجهة المقدمة", "source": "submission"},
    {"key": "course_date", "type": "date", "label_en": "Course Date", "label_ar": "تاريخ الدورة", "source": "submission", "required": true}
  ]},
  {"key": "evaluation", "title_en": "Evaluation", "title_ar": "التقييم", "fields": [
    {"key": "rate_content", "type": "radio", "label_en": "Course Content", "label_ar": "محتوى الدورة", "source": "submission", "options": [
      {"value": "excellent", "label_en": "Excellent", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "fair", "label_en": "Fair", "label_ar": "مقبول"}, {"value": "poor", "label_en": "Poor", "label_ar": "ضعيف"}]},
    {"key": "rate_trainer", "type": "radio", "label_en": "Trainer", "label_ar": "المدرب", "source": "submission", "options": [
      {"value": "excellent", "label_en": "Excellent", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "fair", "label_en": "Fair", "label_ar": "مقبول"}, {"value": "poor", "label_en": "Poor", "label_ar": "ضعيف"}]},
    {"key": "rate_materials", "type": "radio", "label_en": "Training Materials", "label_ar": "المواد التدريبية", "source": "submission", "options": [
      {"value": "excellent", "label_en": "Excellent", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "fair", "label_en": "Fair", "label_ar": "مقبول"}, {"value": "poor", "label_en": "Poor", "label_ar": "ضعيف"}]},
    {"key": "rate_venue", "type": "radio", "label_en": "Venue & Organization", "label_ar": "المكان والتنظيم", "source": "submission", "options": [
      {"value": "excellent", "label_en": "Excellent", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "fair", "label_en": "Fair", "label_ar": "مقبول"}, {"value": "poor", "label_en": "Poor", "label_ar": "ضعيف"}]},
    {"key": "rate_overall", "type": "radio", "label_en": "Overall Rating", "label_ar": "التقييم العام", "source": "submission", "required": true, "options": [
      {"value": "excellent", "label_en": "Excellent", "label_ar": "ممتاز"}, {"value": "good", "label_en": "Good", "label_ar": "جيد"}, {"value": "fair", "label_en": "Fair", "label_ar": "مقبول"}, {"value": "poor", "label_en": "Poor", "label_ar": "ضعيف"}]},
    {"key": "benefits_gained", "type": "textarea", "label_en": "Key Benefits Gained", "label_ar": "أبرز الفوائد المكتسبة", "source": "submission"},
    {"key": "comments", "type": "textarea", "label_en": "Comments & Suggestions", "label_ar": "ملاحظات ومقترحات", "source": "submission"},
    {"key": "sig_trainee", "type": "signature", "label_en": "Trainee", "label_ar": "المتدرب", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 28) Request for Company Stamp
('company-stamp-request', 'Request for Company Stamp', 'طلب استخدام ختم الشركة', 'general', 'HR-FRM-028', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "request", "title_en": "Request", "title_ar": "الطلب", "fields": [
    {"key": "requested_by", "type": "text", "label_en": "Requested By", "label_ar": "مقدم الطلب", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "nationality", "type": "text", "label_en": "Nationality", "label_ar": "الجنسية", "source": "employee", "employee_field": "nationality"},
    {"key": "national_id", "type": "text", "label_en": "Iqama / National ID Number", "label_ar": "رقم الإقامة / الهوية", "source": "employee", "employee_field": "national_id"},
    {"key": "job_title", "type": "text", "label_en": "Job Title", "label_ar": "المسمى الوظيفي", "source": "employee", "employee_field": "job_title"},
    {"key": "reason", "type": "textarea", "label_en": "The Reason for the Request", "label_ar": "سبب الطلب", "source": "submission", "required": true},
    {"key": "sig_requester", "type": "signature", "label_en": "Requester", "label_ar": "مقدم الطلب", "source": "submission"},
    {"key": "sig_line_manager", "type": "signature", "label_en": "Line Manager", "label_ar": "المدير المباشر", "source": "submission"}
  ]},
  {"key": "decision", "title_en": "Decision (CEO)", "title_ar": "القرار (الرئيس التنفيذي)", "fields": [
    {"key": "decision", "type": "radio", "label_en": "Decision", "label_ar": "القرار", "source": "submission", "options": [
      {"value": "approved", "label_en": "Approved", "label_ar": "موافقة"}, {"value": "rejected", "label_en": "Rejected", "label_ar": "رفض"}]},
    {"key": "stamp_mark", "type": "text", "label_en": "Stamp Mark / Initials", "label_ar": "علامة الختم / الأحرف", "source": "submission"},
    {"key": "sig_ceo", "type": "signature", "label_en": "CEO", "label_ar": "الرئيس التنفيذي", "source": "submission"},
    {"key": "sig_supply_chain", "type": "signature", "label_en": "Supply Chain Manager (if approved)", "label_ar": "مدير سلسلة الإمداد (عند الموافقة)", "source": "submission"}
  ]},
  {"key": "receipt", "title_en": "Receipt Acknowledgement", "title_ar": "إقرار الاستلام",
   "note_en": "I, the undersigned, hereby acknowledge that I have received the Company Stamp and undertake to use it with full responsibility for company purposes only.",
   "note_ar": "أقر أنا الموقع أدناه باستلامي ختم الشركة وأتعهد باستخدامه بمسؤولية كاملة ولأغراض الشركة فقط.",
   "fields": [
    {"key": "sig_acknowledged_by", "type": "signature", "label_en": "Acknowledged By", "label_ar": "المُقِر", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 29) Employment Application Form
('employment-application', 'Employment Application Form', 'نموذج طلب توظيف', 'recruitment', 'HR-FRM-029', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "personal", "title_en": "Personal Information", "title_ar": "المعلومات الشخصية",
   "note_en": "Kindly fill out the form completely and return it signed along with your updated CV. All information is treated confidentially.",
   "note_ar": "يرجى تعبئة النموذج كاملًا وإعادته موقعًا مع سيرتك الذاتية المحدثة. تُعامل جميع المعلومات بسرية تامة.",
   "fields": [
    {"key": "candidate_name", "type": "text", "label_en": "Candidate Full Name", "label_ar": "اسم المتقدم الكامل", "source": "submission", "required": true},
    {"key": "current_address", "type": "text", "label_en": "Current Address", "label_ar": "العنوان الحالي", "source": "submission"},
    {"key": "email", "type": "text", "label_en": "Email Address", "label_ar": "البريد الإلكتروني", "source": "submission", "required": true},
    {"key": "contact_number", "type": "text", "label_en": "Contact Number", "label_ar": "رقم التواصل", "source": "submission", "required": true},
    {"key": "nationality", "type": "text", "label_en": "Nationality", "label_ar": "الجنسية", "source": "submission"},
    {"key": "marital_status", "type": "radio", "label_en": "Marital Status", "label_ar": "الحالة الاجتماعية", "source": "submission", "options": [
      {"value": "single", "label_en": "Single", "label_ar": "أعزب"}, {"value": "married", "label_en": "Married", "label_ar": "متزوج"}]},
    {"key": "dependents", "type": "number", "label_en": "No. of Dependents", "label_ar": "عدد المعالين", "source": "submission"},
    {"key": "education", "type": "text", "label_en": "Education", "label_ar": "المؤهل العلمي", "source": "submission"},
    {"key": "major", "type": "text", "label_en": "Major In", "label_ar": "التخصص", "source": "submission"}
  ]},
  {"key": "experience", "title_en": "Previous / Current Experience", "title_ar": "الخبرة السابقة / الحالية", "fields": [
    {"key": "employer_name", "type": "text", "label_en": "Employer's Name", "label_ar": "اسم جهة العمل", "source": "submission"},
    {"key": "current_designation", "type": "text", "label_en": "Current Designation", "label_ar": "المسمى الوظيفي الحالي", "source": "submission"},
    {"key": "from_date", "type": "date", "label_en": "From Date", "label_ar": "من تاريخ", "source": "submission"},
    {"key": "to_date", "type": "date", "label_en": "To Date", "label_ar": "إلى تاريخ", "source": "submission"},
    {"key": "reporting_to", "type": "text", "label_en": "Reporting To (position)", "label_ar": "يرفع تقاريره إلى", "source": "submission"},
    {"key": "current_basic", "type": "currency", "label_en": "Current Basic Salary / month", "label_ar": "الراتب الأساسي الحالي شهريًا", "source": "submission"},
    {"key": "current_housing", "type": "currency", "label_en": "Current Housing / month", "label_ar": "بدل السكن الحالي شهريًا", "source": "submission"},
    {"key": "current_transport", "type": "currency", "label_en": "Current Transportation / month", "label_ar": "بدل المواصلات الحالي شهريًا", "source": "submission"},
    {"key": "current_others", "type": "currency", "label_en": "Current Others / month", "label_ar": "بدلات أخرى حالية شهريًا", "source": "submission"},
    {"key": "expected_salary", "type": "currency", "label_en": "Expected Gross Salary / month", "label_ar": "إجمالي الراتب المتوقع شهريًا", "source": "submission"},
    {"key": "negotiable", "type": "radio", "label_en": "Is your expected salary negotiable?", "label_ar": "هل الراتب المتوقع قابل للتفاوض؟", "source": "submission", "options": [
      {"value": "yes", "label_en": "Yes", "label_ar": "نعم"}, {"value": "no", "label_en": "No", "label_ar": "لا"}]}
  ]},
  {"key": "other", "title_en": "Other Relevant Information", "title_ar": "معلومات أخرى", "fields": [
    {"key": "languages", "type": "text", "label_en": "Languages Spoken", "label_ar": "اللغات المتحدث بها", "source": "submission", "placeholder_en": "English, Arabic, ..."},
    {"key": "travel_in_kingdom", "type": "radio", "label_en": "Do you mind travel in Kingdom?", "label_ar": "هل تمانع السفر داخل المملكة؟", "source": "submission", "options": [
      {"value": "yes", "label_en": "Yes", "label_ar": "نعم"}, {"value": "no", "label_en": "No", "label_ar": "لا"}]},
    {"key": "travel_out_kingdom", "type": "radio", "label_en": "Do you mind travel out of Kingdom?", "label_ar": "هل تمانع السفر خارج المملكة؟", "source": "submission", "options": [
      {"value": "yes", "label_en": "Yes", "label_ar": "نعم"}, {"value": "no", "label_en": "No", "label_ar": "لا"}]},
    {"key": "visa_status", "type": "radio", "label_en": "If currently in KSA, visa status", "label_ar": "إن كنت داخل المملكة، ما وضع تأشيرتك؟", "source": "submission", "options": [
      {"value": "saudi", "label_en": "Saudi", "label_ar": "سعودي"}, {"value": "work", "label_en": "Work", "label_ar": "عمل"}, {"value": "visit", "label_en": "Visit", "label_ar": "زيارة"}]},
    {"key": "relocate", "type": "radio", "label_en": "Willing to relocate to the company's city?", "label_ar": "هل أنت مستعد للانتقال إلى مدينة الشركة؟", "source": "submission", "options": [
      {"value": "yes", "label_en": "Yes", "label_ar": "نعم"}, {"value": "no", "label_en": "No", "label_ar": "لا"}]},
    {"key": "relatives", "type": "radio", "label_en": "Any relatives at the company?", "label_ar": "هل لديك أقارب في الشركة؟", "source": "submission", "options": [
      {"value": "yes", "label_en": "Yes", "label_ar": "نعم"}, {"value": "no", "label_en": "No", "label_ar": "لا"}]},
    {"key": "relatives_details", "type": "text", "label_en": "If yes: name & relationship", "label_ar": "إن نعم: الاسم وصلة القرابة", "source": "submission"},
    {"key": "notice_period", "type": "text", "label_en": "Notice Period", "label_ar": "فترة الإشعار", "source": "submission"},
    {"key": "passport_validity", "type": "date", "label_en": "Passport Validity", "label_ar": "صلاحية الجواز", "source": "submission"},
    {"key": "sig_candidate", "type": "signature", "label_en": "Name, Signature & Date", "label_ar": "الاسم والتوقيع والتاريخ", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 30) Travel Authorization Form
('travel-authorization', 'Travel Authorization Form', 'نموذج تصريح سفر', 'general', 'HR-FRM-030', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "employee", "title_en": "Employee Information", "title_ar": "بيانات الموظف", "fields": [
    {"key": "employee_full_name", "type": "text", "label_en": "Name", "label_ar": "الاسم", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "employee_no", "type": "text", "label_en": "Employee ID", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no"},
    {"key": "position", "type": "text", "label_en": "Position", "label_ar": "الوظيفة", "source": "employee", "employee_field": "job_title"},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"}
  ]},
  {"key": "travel", "title_en": "Travel Details", "title_ar": "تفاصيل السفر", "fields": [
    {"key": "destination", "type": "text", "label_en": "Destination (City & Country)", "label_ar": "الوجهة (المدينة والدولة)", "source": "submission", "required": true},
    {"key": "purpose", "type": "radio", "label_en": "Purpose of Travel", "label_ar": "الغرض من السفر", "source": "submission", "required": true, "options": [
      {"value": "supplier_visit", "label_en": "Supplier Visit", "label_ar": "زيارة مورد"},
      {"value": "training", "label_en": "Training", "label_ar": "تدريب"},
      {"value": "exhibitions", "label_en": "Exhibitions / Trade Shows", "label_ar": "معارض"},
      {"value": "recruitment", "label_en": "Recruitment", "label_ar": "توظيف"},
      {"value": "business_meeting", "label_en": "Business Meeting", "label_ar": "اجتماع عمل"},
      {"value": "other", "label_en": "Other", "label_ar": "أخرى"}]},
    {"key": "purpose_other", "type": "text", "label_en": "Other (please specify)", "label_ar": "أخرى (حدد)", "source": "submission"},
    {"key": "departure_date", "type": "date", "label_en": "Departure Date", "label_ar": "تاريخ المغادرة", "source": "submission", "required": true},
    {"key": "return_date", "type": "date", "label_en": "Return Date", "label_ar": "تاريخ العودة", "source": "submission", "required": true},
    {"key": "trip_days", "type": "computed", "label_en": "Trip Days", "label_ar": "أيام الرحلة", "source": "computed", "formula": "date_diff_days(departure_date, return_date)"},
    {"key": "category", "type": "radio", "label_en": "Category", "label_ar": "الفئة", "source": "submission", "options": [
      {"value": "domestic_near", "label_en": "Domestic (80-300 KM) + Bahrain", "label_ar": "داخلي (80-300 كم) + البحرين"},
      {"value": "domestic_far", "label_en": "Domestic (>300 KM)", "label_ar": "داخلي (أكثر من 300 كم)"},
      {"value": "gcc", "label_en": "GCC (except Bahrain)", "label_ar": "دول الخليج (عدا البحرين)"},
      {"value": "uae_adipec", "label_en": "UAE - ADIPEC", "label_ar": "الإمارات - أديبك"},
      {"value": "international", "label_en": "International", "label_ar": "دولي"}]},
    {"key": "accommodation", "type": "radio", "label_en": "Accommodation Arrangement", "label_ar": "ترتيب السكن", "source": "submission", "options": [
      {"value": "company", "label_en": "Company", "label_ar": "الشركة"},
      {"value": "self", "label_en": "Myself (per diem rate)", "label_ar": "بنفسي (بدل يومي)"}]},
    {"key": "transport", "type": "radio", "label_en": "Transport Arrangement", "label_ar": "ترتيب المواصلات", "source": "submission", "options": [
      {"value": "company", "label_en": "Company", "label_ar": "الشركة"},
      {"value": "self", "label_en": "Myself (per diem rate)", "label_ar": "بنفسي (بدل يومي)"}]}
  ]},
  {"key": "acknowledgment", "title_en": "Acknowledgement & Approval", "title_ar": "الإقرار والاعتماد",
   "note_en": "I acknowledge that I have read and understood the company's Business Travel Policy and agree to adhere to all its guidelines and procedures.",
   "note_ar": "أقر بأنني قرأت وفهمت سياسة سفر العمل الخاصة بالشركة وأوافق على الالتزام بجميع إرشاداتها وإجراءاتها.",
   "fields": [
    {"key": "sig_employee", "type": "signature", "label_en": "Employee", "label_ar": "الموظف", "source": "submission"},
    {"key": "sig_approver", "type": "signature", "label_en": "Approved By (Name & Position)", "label_ar": "اعتمده (الاسم والمنصب)", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true),

-- 31) Vacation Receipt
('vacation-receipt', 'Vacation Receipt', 'مستند صرف إجازة', 'payroll', 'HR-FRM-031', 'HR', 1, '1', CURRENT_DATE, $json$
{"sections": [
  {"key": "personal", "title_en": "Personal Details", "title_ar": "البيانات الشخصية", "fields": [
    {"key": "employee_full_name", "type": "text", "label_en": "Name", "label_ar": "الاسم", "source": "employee", "employee_field": "full_name_en", "required": true},
    {"key": "employee_no", "type": "text", "label_en": "Company ID No.", "label_ar": "الرقم الوظيفي", "source": "employee", "employee_field": "employee_no"},
    {"key": "national_id", "type": "text", "label_en": "National / ID No.", "label_ar": "رقم الهوية", "source": "employee", "employee_field": "national_id"},
    {"key": "joining_date", "type": "date", "label_en": "Joining Date", "label_ar": "تاريخ الالتحاق", "source": "employee", "employee_field": "hire_date"},
    {"key": "nationality", "type": "text", "label_en": "Nationality", "label_ar": "الجنسية", "source": "employee", "employee_field": "nationality"},
    {"key": "position", "type": "text", "label_en": "Position", "label_ar": "الوظيفة", "source": "employee", "employee_field": "job_title"},
    {"key": "department", "type": "text", "label_en": "Department", "label_ar": "الإدارة", "source": "employee", "employee_field": "department"}
  ]},
  {"key": "salary", "title_en": "Monthly Salary and Allowances", "title_ar": "الراتب الشهري والبدلات", "fields": [
    {"key": "basic_salary", "type": "currency", "label_en": "Basic Salary", "label_ar": "الراتب الأساسي", "source": "employee", "employee_field": "base_salary"},
    {"key": "housing", "type": "currency", "label_en": "Housing", "label_ar": "بدل السكن", "source": "employee", "employee_field": "housing_allowance"},
    {"key": "transportation", "type": "currency", "label_en": "Transportation", "label_ar": "بدل المواصلات", "source": "employee", "employee_field": "transport_allowance"},
    {"key": "food_allowance", "type": "currency", "label_en": "Food Allowance", "label_ar": "بدل الطعام", "source": "submission"},
    {"key": "shift_allowance", "type": "currency", "label_en": "Shift Allowance", "label_ar": "بدل الوردية", "source": "submission"},
    {"key": "other_allowance", "type": "currency", "label_en": "Other Allowance", "label_ar": "بدلات أخرى", "source": "submission"},
    {"key": "gross_pay", "type": "computed", "label_en": "Gross Pay", "label_ar": "إجمالي الراتب", "source": "computed", "formula": "sum_fields(basic_salary, housing, transportation, food_allowance, shift_allowance, other_allowance)", "format": "currency"}
  ]},
  {"key": "payment", "title_en": "Payment Details", "title_ar": "تفاصيل الصرف", "fields": [
    {"key": "vacation_balance", "type": "number", "label_en": "Vacation Balance (days)", "label_ar": "رصيد الإجازة (أيام)", "source": "submission", "required": true},
    {"key": "annual_leave_pay", "type": "computed", "label_en": "Annual Leave Vacation (SAR)", "label_ar": "بدل الإجازة السنوية (ر.س)", "source": "computed", "formula": "leave_payout(gross_pay, vacation_balance)", "format": "currency"},
    {"key": "overtime", "type": "currency", "label_en": "Overtime (SAR)", "label_ar": "العمل الإضافي (ر.س)", "source": "submission"},
    {"key": "total_income", "type": "computed", "label_en": "Total Amount (Income)", "label_ar": "إجمالي المستحقات", "source": "computed", "formula": "sum_fields(annual_leave_pay, overtime)", "format": "currency"},
    {"key": "total_deductions", "type": "currency", "label_en": "Total Amount (Deductions)", "label_ar": "إجمالي الاستقطاعات", "source": "submission"},
    {"key": "deduction_justifications", "type": "text", "label_en": "Deduction Justifications", "label_ar": "مبررات الاستقطاع", "source": "submission"},
    {"key": "net_due", "type": "computed", "label_en": "Total Amount Due (SAR)", "label_ar": "صافي المستحق (ر.س)", "source": "computed", "formula": "subtract(total_income, total_deductions)", "format": "currency"},
    {"key": "bank_name", "type": "text", "label_en": "Bank Name", "label_ar": "اسم البنك", "source": "employee", "employee_field": "bank_name"},
    {"key": "iban", "type": "text", "label_en": "IBAN Number", "label_ar": "رقم الآيبان", "source": "employee", "employee_field": "bank_iban"}
  ]},
  {"key": "endorsement", "title_en": "Employee Endorsement", "title_ar": "إقرار الموظف",
   "note_en": "I, the employee, acknowledge that I have received all my entitlements for the vacation period stated above and have no further claims regarding it.",
   "note_ar": "أقر أنا الموظف بأنني استلمت كامل مستحقاتي عن فترة الإجازة المبينة أعلاه، وليس لي أي مطالبات أخرى بشأنها.",
   "fields": [
    {"key": "sig_prepared_by", "type": "signature", "label_en": "Prepared By", "label_ar": "أعده", "source": "submission"},
    {"key": "sig_verified_by", "type": "signature", "label_en": "Verified By", "label_ar": "دققه", "source": "submission"},
    {"key": "sig_approved_by", "type": "signature", "label_en": "Approved By", "label_ar": "اعتمده", "source": "submission"},
    {"key": "sig_employee", "type": "signature", "label_en": "Received By (Employee)", "label_ar": "استلمه (الموظف)", "source": "submission"}
  ]}
]}
$json$::jsonb, 'published', true)

ON CONFLICT (slug, version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
