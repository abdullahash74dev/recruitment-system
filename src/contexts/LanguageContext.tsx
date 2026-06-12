import { createContext, useContext, useState, ReactNode } from "react";

export type Lang = "ar" | "en";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
}

const translations: Record<Lang, Record<string, string>> = {
  ar: {
    // Navbar & general
    "nav.apply": "تقدم الآن",
    "nav.formTitle": "نموذج التقديم الوظيفي",
    "nav.jobs": "الوظائف الشاغرة",
    "nav.dashboard": "لوحة التحكم",
    "footer.rights": "منصة التوظيف الذكية — جميع الحقوق محفوظة",

    // Hero
    "hero.title1": "ابنِ مستقبلك المهني",
    "hero.title2": "مع منصة التوظيف الذكية",
    "hero.desc": "نبحث عن كفاءات متميزة للانضمام لفريقنا. قدّم طلبك الآن واكتشف الفرص الوظيفية المتاحة.",
    "hero.cta": "تقدم للوظيفة",
    "hero.viewJobs": "تصفح الوظائف الشاغرة",

    // Features
    "features.title": "لماذا منصة التوظيف الذكية؟",
    "features.desc": "نقدم بيئة عمل محفزة وفرص نمو حقيقية لكل فرد في فريقنا",
    "features.env.title": "بيئة عمل احترافية",
    "features.env.desc": "نوفر بيئة عمل محفزة تساعدك على الإبداع والتطور المهني المستمر.",
    "features.team.title": "فريق متميز",
    "features.team.desc": "انضم لفريق من المحترفين والخبراء في مختلف المجالات والتخصصات.",
    "features.growth.title": "فرص نمو حقيقية",
    "features.growth.desc": "نؤمن بتطوير كوادرنا ونقدم مسارات وظيفية واضحة للترقي.",

    // CTA
    "cta.title": "جاهز للخطوة التالية؟",
    "cta.desc": "تقديم الطلب يستغرق بضع دقائق فقط. بياناتك تُحفظ تلقائياً.",
    "cta.button": "ابدأ التقديم الآن",

    // Apply page
    "apply.title": "انضم لفريق منصة التوظيف الذكية",
    "apply.desc": "يرجى تعبئة النموذج التالي بدقة. سيتم التواصل معك بعد مراجعة طلبك.",

    // Steps
    "step.basic": "البيانات الأساسية",
    "step.job": "التفضيلات الوظيفية",
    "step.edu": "المؤهل العلمي",
    "step.exp": "الخبرات والمهارات",
    "step.fin": "التوقعات المالية",
    "step.attach": "المرفقات",

    // Buttons
    "btn.next": "التالي",
    "btn.prev": "السابق",
    "btn.submit": "إرسال الطلب",
    "btn.submitting": "جاري الإرسال...",
    "btn.newApplication": "تقديم طلب جديد",

    // Success
    "success.title": "تم إرسال طلبك بنجاح!",
    "success.desc": "شكراً لتقديمك على الوظيفة في منصة التوظيف الذكية. سيتم مراجعة طلبك والتواصل معك في أقرب وقت.",

    // Track application status
    "track.title": "تتبع حالة طلبك",
    "track.subtitle": "أدخل البريد الإلكتروني ورقم الهاتف المستخدمين عند التقديم لمعرفة حالة طلبك",
    "track.email": "البريد الإلكتروني",
    "track.phone": "رقم الهاتف",
    "track.submit": "تحقق من الحالة",
    "track.checking": "جارٍ البحث...",
    "track.notFound": "لم يتم العثور على طلب مطابق لهذه البيانات",
    "track.error": "حدث خطأ، حاول مرة أخرى",
    "track.position": "الوظيفة المتقدم لها",
    "track.appliedOn": "تاريخ التقديم",
    "track.lastUpdate": "آخر تحديث",
    "track.results": "نتائج البحث",
    "track.backHome": "العودة للرئيسية",
    "track.cta": "تتبع طلبك في أي وقت",
    "track.ctaDesc": "احتفظ بالبريد الإلكتروني ورقم الهاتف المستخدمين، يمكنك متابعة حالة طلبك دون الحاجة لتسجيل الدخول",

    // Validation
    "validation.required": "يرجى تعبئة جميع الحقول المطلوبة",
    "validation.success": "تم إرسال طلبك بنجاح!",

    // Basic Info fields
    "field.fullName": "الاسم الكامل",
    "field.gender": "الجنس",
    "field.nationality": "الجنسية",
    "field.birthDate": "تاريخ الميلاد",
    "field.maritalStatus": "الحالة الاجتماعية",
    "field.dependents": "عدد المعالين (إذا كنت متزوج)",
    "field.phone": "رقم الجوال",
    "field.mobile": "رقم الجوال",
    "field.email": "البريد الإلكتروني",
    "field.currentCity": "مقر السكن الحالي",
    "field.hasTransport": "هل لديك وسيلة مواصلات؟",

    // Job Preferences
    "field.desiredPosition": "الوظيفة المرغوب التقديم عليها",
    "field.jobType": "نوع الوظيفة",
    "field.preferredCity": "المدينة التي ترغب بالعمل فيها",
    "field.hearAbout": "كيف سمعت عن هذه الفرصة؟",

    // Education
    "field.educationLevel": "المؤهل العلمي الحالي",
    "field.major": "التخصص",
    "field.university": "الجامعة / المعهد",
    "field.graduationYear": "سنة التخرج",
    "field.gpa": "المعدل التراكمي",
    "field.currentlyStudying": "هل ملتحق حالياً بدراسة أخرى؟",
    "field.currentStudy": "ماهي الدراسة الحالية؟",

    // Experience
    "field.yearsExperience": "عدد سنوات الخبرة",
    "field.currentlyEmployed": "هل أنت على رأس العمل؟",
    "field.currentTitle": "المسمى الوظيفي الحالي",
    "field.currentTasks": "نبذة عن المهام الحالية",
    "field.selfSummary": "الملخص المهني (ملخص + المهام الحالية + خبرات أخرى)",
    "field.otherExperience": "ماهي الخبرات المصاحبة في مجال غير التخصص؟",
    "ph.selfSummaryMerged": "اكتب ملخصاً مهنياً شاملاً يجمع: نبذة عنك، أهم مهامك السابقة أو الحالية، وأي خبرات إضافية في مجالات أخرى. إن لم تكن تعمل حالياً يمكنك ذكر مؤهلاتك ومهاراتك.",
    "field.arabicLevel": "مستوى اللغة العربية",
    "field.englishLevel": "مستوى اللغة الإنجليزية",
    "field.otherLanguage": "لغة أخرى",
    "field.linkedin": "رابط LinkedIn",

    // Financials
    "field.currentSalary": "الراتب الحالي (ريال)",
    "field.expectedSalary": "الراتب المتوقع (ريال)",
    "field.availableDate": "تاريخ الانضمام المتوقع",
    "field.expectedJoinDate": "تاريخ الانضمام المتوقع",

    // Attachments
    "field.resume": "تحميل السيرة الذاتية",
    "field.degreeCopy": "صورة من المؤهل العلمي (اختياري)",
    "field.trainingCerts": "مستندات الدورات التدريبية (اختياري)",
    "field.otherDocs": "أي شهادة أخرى ترغب بإضافتها (اختياري)",

    // Placeholders
    "ph.fullName": "أدخل اسمك الكامل",
    "ph.phone": "05XXXXXXXX",
    "ph.email": "example@email.com",
    "ph.city": "المدينة",
    "ph.select": "اختر...",
    "ph.major": "أدخل تخصصك",
    "ph.university": "اسم الجامعة أو المعهد",
    "ph.graduationYear": "مثال: 2020",
    "ph.gpa": "مثال: 4.5 من 5",
    "ph.currentStudy": "وصف الدراسة الحالية",
    "ph.currentTitle": "المسمى الوظيفي",
    "ph.currentTasks": "اذكر أبرز مهامك الحالية...",
    "ph.selfSummary": "اكتب ملخصاً مهنياً موجزاً عن نفسك...",
    "ph.otherExperience": "اذكر أي خبرات إضافية...",
    "ph.otherLanguage": "حدد اللغة ومستواك",
    "ph.linkedin": "https://linkedin.com/in/...",
    "ph.salary": "مثال: 8000",
    "ph.dependents": "0",

    // Select options
    "opt.male": "ذكر",
    "opt.female": "أنثى",
    "opt.single": "أعزب/عزباء",
    "opt.married": "متزوج/ة",
    "opt.divorced": "مطلق/ة",
    "opt.widowed": "أرمل/ة",
    "opt.yes": "نعم",
    "opt.no": "لا",
    "opt.fulltime": "دوام كامل",
    "opt.parttime": "دوام جزئي",
    "opt.remote": "عن بُعد",
    "opt.contract": "عقد مؤقت",
    "opt.coop": "تدريب تعاوني",
    "opt.tamheer": "تمهير",
    "opt.immediate": "فوري",
    "opt.oneWeek": "خلال أسبوع",
    "opt.twoWeeks": "خلال أسبوعين",
    "opt.oneMonth": "خلال شهر",
    "opt.twoMonths": "خلال شهرين",
    "opt.moreThanTwo": "أكثر من شهرين",
    "opt.eastern": "المنطقة الشرقية",
    "opt.riyadh": "الرياض",
    "opt.jeddah": "جدة",

    // Language levels
    "opt.excellent": "ممتاز",
    "opt.veryGood": "جيد جداً",
    "opt.good": "جيد",
    "opt.average": "متوسط",
    "opt.beginner": "مبتدئ",

    // hearAbout
    "opt.linkedin": "LinkedIn",
    "opt.twitter": "تويتر / X",
    "opt.website": "موقع الشركة",
    "opt.friend": "صديق أو معارف",
    "opt.jobPlatform": "منصة توظيف",
    "opt.other": "أخرى",

    // Jobs page
    "jobs.title": "الوظائف الشاغرة",
    "jobs.desc": "تصفح قائمة الوظائف المتاحة حالياً وانضم إلى فريقنا المتميز.",
    "jobs.noJobs": "لا توجد وظائف شاغرة حالياً",
    "jobs.applyNow": "قدم الآن",
    "jobs.location": "الموقع",
    "jobs.type": "نوع الوظيفة",
    "jobs.department": "القسم",
    "jobs.postedOn": "تاريخ النشر",
    "jobs.available": "متاح",
    "jobs.vacancies": "شاغر",
    "jobs.searchPlaceholder": "ابحث عن وظيفة...",
    "jobs.filter": "تصفية",

    // Facility management question
    "field.facilityManagementExp": "هل عملت في الصيانة والتشغيل والمرافق العامة؟",
    "opt.facilityYes": "نعم",
    "opt.facilityContractor": "عملت في مجال المقاولات",
    "opt.facilityBoth": "عملت في كل من المجالين",
    "opt.facilityNo": "لا، لم أعمل في أي من المجالين",

    // Dashboard vacancy
    "dash.vacancyCount": "عدد الشواغر",

    // Nav
    "nav.home": "الرئيسية",

    // Dashboard
    "dash.title": "لوحة تحكم الموارد البشرية",
    "dash.totalApplicants": "إجمالي المتقدمين",
    "dash.newApplicants": "متقدمين جدد",
    "dash.inInterview": "في المقابلات",
    "dash.hired": "تم توظيفهم",
    "dash.applicants": "المتقدمون",
    "dash.search": "بحث بالاسم أو الوظيفة...",
    "dash.export": "تصدير Excel",
    "dash.status": "الحالة",
    "dash.name": "الاسم",
    "dash.position": "الوظيفة",
    "dash.city": "المدينة",
    "dash.date": "تاريخ التقديم",
    "dash.actions": "الإجراءات",
    "dash.notes": "الملاحظات",
    "dash.saveNotes": "حفظ الملاحظات",
    "dash.updateStatus": "تحديث الحالة",
    "dash.viewDetails": "عرض التفاصيل",
    "dash.byStatus": "حسب الحالة",
    "dash.byPosition": "حسب الوظيفة",
    "dash.byCity": "حسب المدينة",
    "dash.timeline": "الجدول الزمني",
    "dash.manageJobs": "إدارة الوظائف",
    "dash.addJob": "إضافة وظيفة",
    "dash.login": "تسجيل الدخول",
    "dash.email": "البريد الإلكتروني",
    "dash.password": "كلمة المرور",
    "dash.loginBtn": "دخول",
    "dash.loginError": "خطأ في البريد أو كلمة المرور",
    "dash.logout": "تسجيل خروج",
    "dash.all": "الكل",
    "dash.filterStatus": "فلترة حسب الحالة",
    "dash.attachments": "المرفقات",
    "dash.viewFile": "عرض الملف",
    "dash.noAttachments": "لا توجد مرفقات",
    "dash.manageUsers": "إدارة المستخدمين",
    "dash.addUser": "إضافة مستخدم",
    "dash.role": "الدور",
    "dash.projects": "المشاريع",
    "dash.addProject": "إضافة مشروع",
    "dash.editJob": "تعديل الوظيفة",
    "dash.deleteJob": "حذف الوظيفة",
    "dash.jobTitle": "عنوان الوظيفة (عربي)",
    "dash.jobTitleEn": "عنوان الوظيفة (إنجليزي)",
    "dash.jobLocation": "الموقع",
    "dash.jobType": "نوع الوظيفة",
    "dash.jobDept": "القسم",
    "dash.jobDesc": "الوصف الوظيفي (عربي)",
    "dash.jobDescEn": "الوصف الوظيفي (إنجليزي)",
    "dash.jobReq": "المتطلبات (عربي)",
    "dash.jobReqEn": "المتطلبات (إنجليزي)",
    "dash.jobActive": "متاح",
    "dash.jobInactive": "غير متاح",
    "dash.save": "حفظ",
    "dash.cancel": "إلغاء",
    "dash.confirm": "تأكيد",
    "dash.saved": "تم الحفظ بنجاح",
    "dash.deleted": "تم الحذف",
    "dash.tab.applicants": "المتقدمون",
    "dash.tab.jobs": "الوظائف",
    "dash.tab.users": "المستخدمين",
    "dash.tab.projects": "المشاريع",
    "dash.tab.analytics": "الإحصائيات",
    "dash.signupEmail": "بريد المستخدم",
    "dash.signupPassword": "كلمة المرور",
    "dash.signupName": "الاسم",
    "dash.userAdded": "تم إضافة المستخدم بنجاح",
    "dash.projectName": "اسم المشروع (عربي)",
    "dash.projectNameEn": "اسم المشروع (إنجليزي)",
    "dash.projectDesc": "وصف المشروع",
    "dash.nationalityRequired": "الجنسية المطلوبة",
    "dash.arabic": "عربي",
    "dash.english": "إنجليزي",

    // Job detail page
    "jobDetail.notFound": "الوظيفة غير موجودة",
    "jobDetail.backToJobs": "العودة للوظائف",
    "jobDetail.viewDetails": "عرض التفاصيل",
    "jobDetail.description": "الوصف الوظيفي",
    "jobDetail.requirements": "المتطلبات",
    "jobDetail.experienceRequired": "سنوات الخبرة المطلوبة",
    "jobDetail.degreeRequired": "المؤهل العلمي المطلوب",
    "jobDetail.additionalDetails": "تفاصيل إضافية",
    "jobDetail.vacancies": "عدد الشواغر",
    "jobDetail.interestedTitle": "مهتم بهذه الوظيفة؟",
    "jobDetail.interestedDesc": "قدّم طلبك الآن وانضم لفريق منصة التوظيف الذكية",
    "jobDetail.postedOn": "تاريخ النشر:",

    // Settings / Custom Questions
    "dash.tab.settings": "الإعدادات",
    "dash.customQuestions": "الأسئلة المخصصة",
    "dash.addQuestion": "إضافة سؤال",
    "dash.editQuestion": "تعديل السؤال",
    "dash.questionAr": "السؤال (عربي)",
    "dash.questionEn": "السؤال (إنجليزي)",
    "dash.questionType": "نوع الحقل",
    "dash.questionType.text": "نص",
    "dash.questionType.select": "اختيار من قائمة",
    "dash.questionType.textarea": "نص طويل",
    "dash.optionsAr": "الخيارات (عربي) - افصل بفاصلة",
    "dash.optionsEn": "الخيارات (إنجليزي) - افصل بفاصلة",
    "dash.questionRequired": "إلزامي",
    "dash.questionStep": "الخطوة في النموذج",
    "dash.questionOrder": "ترتيب العرض",
    "dash.noQuestions": "لا توجد أسئلة مخصصة بعد",

    // User management
    "dash.userEmail": "البريد الإلكتروني",
    "dash.userName": "اسم العرض",
    "dash.userRole": "الصلاحية",
    "dash.userStatus": "الحالة",
    "dash.userActive": "مفعّل",
    "dash.userInactive": "معطّل",
    "dash.noUsers": "لا يوجد مستخدمين بعد",
    "dash.confirmDelete": "هل أنت متأكد من حذف هذا المستخدم؟",
    "dash.userDeleted": "تم حذف المستخدم",
    "dash.roleUpdated": "تم تحديث الصلاحية",
    "dash.statusUpdated": "تم تحديث حالة المستخدم",
    "dash.displayName": "اسم العرض",

    // Roles
    "role.admin": "مدير النظام",
    "role.hr_manager": "مدير الموارد البشرية",
    "role.recruitment_coordinator": "منسق التوظيف",
    "role.project_manager": "مدير المشروع",

    // Statuses
    "status.new": "جديد",
    "status.reviewing": "قيد المراجعة",
    "status.phone_interview": "مقابلة هاتفية",
    "status.in_person_interview": "مقابلة شخصية",
    "status.accepted": "تم التوظيف",
    "status.hired": "تم التوظيف",
    "status.rejected": "مرفوض",
    "status.withdrawn": "منسحب",

    // Training page
    "nav.training": "التدريب التعاوني / تمهير",
    "nav.track": "تتبع الطلب",
    "training.title": "فرص التدريب التعاوني وتمهير",
    "training.desc": "انضم لبرامج التدريب التعاوني وتمهير في منصة التوظيف الذكية",
    "training.noJobs": "لا توجد فرص تدريب متاحة حالياً",
    "training.applyNow": "قدم على الفرصة",

    // Duplicate detection
    "dup.title": "تم اكتشاف تقديم سابق",
    "dup.desc": "وجدنا طلباً سابقاً مسجلاً بنفس الاسم والإيميل والجوال. هل ترغب في تحديث بياناتك بدلاً من التقديم من جديد؟",
    "dup.update": "تحديث الطلب السابق",
    "dup.cancel": "إلغاء",
    "dup.updated": "تم تحديث طلبك بنجاح",
    "dup.identityMismatch": "بيانات الهوية غير متطابقة",

    // Admin
    "admin.loginDesc": "بوابة الدخول لفريق الموارد البشرية والإدارة",
    "admin.forgotPassword": "نسيت كلمة المرور؟",
    "admin.forgotDesc": "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور",
    "admin.sendReset": "إرسال رابط الاستعادة",
    "admin.resetSent": "تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني. يرجى التحقق من صندوق الوارد.",
    "admin.resetError": "حدث خطأ. يرجى المحاولة مرة أخرى.",
    "admin.backToLogin": "العودة لتسجيل الدخول",
    "admin.newPassword": "كلمة المرور الجديدة",
    "admin.newPasswordLabel": "كلمة المرور الجديدة",
    "admin.confirmPassword": "تأكيد كلمة المرور",
    "admin.updatePassword": "تحديث كلمة المرور",
    "admin.passwordUpdated": "تم تحديث كلمة المرور بنجاح! سيتم تحويلك لصفحة الدخول...",
    "admin.passwordMismatch": "كلمتا المرور غير متطابقتين",
    "admin.passwordTooShort": "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
    "admin.invalidResetLink": "رابط إعادة التعيين غير صالح أو منتهي الصلاحية",
    "admin.otpSent": "تم إرسال رابط التحقق إلى بريدك الإلكتروني",
    "admin.otpSendError": "فشل إرسال رابط التحقق. حاول مرة أخرى.",
    "admin.otpInvalid": "كود التحقق غير صحيح أو منتهي الصلاحية",
    "admin.otpLabel": "أدخل كود التحقق",
    "admin.magicLinkDesc": "تم إرسال رابط تسجيل الدخول إلى بريدك الإلكتروني",
    "admin.checkEmailForLink": "تحقق من بريدك الإلكتروني واضغط على رابط تسجيل الدخول",
    "admin.clickLinkToLogin": "بعد الضغط على الرابط سيتم تسجيل دخولك تلقائياً",
    "admin.verifyOtp": "تحقق",
    "admin.resendOtp": "إعادة إرسال الرابط",
    "admin.emailNotRegistered": "هذا البريد الإلكتروني غير مسجل في النظام",
    "admin.noAccess": "ليس لديك صلاحية الوصول",
    "admin.noAccessDesc": "حسابك مسجل ولكن لا يملك صلاحية الدخول إلى لوحة التحكم. يرجى التواصل مع مسؤول النظام لمنحك صلاحية، أو تسجيل الخروج وتجربة حساب آخر.",
    "admin.twoFactorTitle": "التحقق بخطوتين",
    "admin.twoFactorDesc": "تم إرسال كود التحقق إلى بريدك الإلكتروني",
    "admin.otpCodeSent": "تم إرسال كود التحقق إلى بريدك الإلكتروني",
    "admin.otpCodeSendError": "فشل إرسال كود التحقق. حاول مرة أخرى.",
    "admin.resendCode": "إعادة إرسال الكود",
  },
  en: {
    // Navbar & general
    "nav.apply": "Apply Now",
    "nav.formTitle": "Job Application Form",
    "nav.jobs": "Job Openings",
    "nav.dashboard": "Dashboard",
    "footer.rights": "NexHire AI — All Rights Reserved",

    // Hero
    "hero.title1": "Build Your Career",
    "hero.title2": "With NexHire AI",
    "hero.desc": "We are looking for outstanding talents to join our team. Apply now and explore available opportunities.",
    "hero.cta": "Apply for a Job",
    "hero.viewJobs": "Browse Job Openings",

    // Features
    "features.title": "Why NexHire AI?",
    "features.desc": "We provide a motivating work environment and real growth opportunities for every team member",
    "features.env.title": "Professional Environment",
    "features.env.desc": "We provide a motivating work environment that helps you innovate and grow professionally.",
    "features.team.title": "Outstanding Team",
    "features.team.desc": "Join a team of professionals and experts across various fields and specializations.",
    "features.growth.title": "Real Growth Opportunities",
    "features.growth.desc": "We believe in developing our people and offer clear career paths for advancement.",

    // CTA
    "cta.title": "Ready for the Next Step?",
    "cta.desc": "The application takes just a few minutes. Your data is saved automatically.",
    "cta.button": "Start Applying Now",

    // Apply page
    "apply.title": "Join the NexHire AI Team",
    "apply.desc": "Please fill out the following form carefully. We will contact you after reviewing your application.",

    // Steps
    "step.basic": "Basic Info",
    "step.job": "Job Preferences",
    "step.edu": "Education",
    "step.exp": "Experience & Skills",
    "step.fin": "Financial Expectations",
    "step.attach": "Attachments",

    // Buttons
    "btn.next": "Next",
    "btn.prev": "Previous",
    "btn.submit": "Submit Application",
    "btn.submitting": "Submitting...",
    "btn.newApplication": "Submit New Application",

    // Success
    "success.title": "Application Submitted Successfully!",
    "success.desc": "Thank you for applying at NexHire AI. Your application will be reviewed and we will contact you soon.",

    // Track application status
    "track.title": "Track Your Application",
    "track.subtitle": "Enter the email and phone number you used when applying to check your application status",
    "track.email": "Email",
    "track.phone": "Phone Number",
    "track.submit": "Check Status",
    "track.checking": "Searching...",
    "track.notFound": "No matching application was found for this information",
    "track.error": "Something went wrong, please try again",
    "track.position": "Position Applied For",
    "track.appliedOn": "Applied On",
    "track.lastUpdate": "Last Updated",
    "track.results": "Search Results",
    "track.backHome": "Back to Home",
    "track.cta": "Track your application anytime",
    "track.ctaDesc": "Keep the email and phone number you applied with — you can check your application status anytime without logging in",

    // Validation
    "validation.required": "Please fill in all required fields",
    "validation.success": "Application submitted successfully!",

    // Basic Info fields
    "field.fullName": "Full Name",
    "field.gender": "Gender",
    "field.nationality": "Nationality",
    "field.birthDate": "Date of Birth",
    "field.maritalStatus": "Marital Status",
    "field.dependents": "Number of Dependents",
    "field.phone": "Mobile Number",
    "field.mobile": "Mobile Number",
    "field.email": "Email Address",
    "field.currentCity": "Current City",
    "field.hasTransport": "Do you have transportation?",

    // Job Preferences
    "field.desiredPosition": "Desired Position",
    "field.jobType": "Job Type",
    "field.preferredCity": "Preferred Work City",
    "field.hearAbout": "How did you hear about us?",

    // Education
    "field.educationLevel": "Education Level",
    "field.major": "Major",
    "field.university": "University / Institute",
    "field.graduationYear": "Graduation Year",
    "field.gpa": "GPA",
    "field.currentlyStudying": "Currently enrolled in another program?",
    "field.currentStudy": "What is your current study?",

    // Experience
    "field.yearsExperience": "Years of Experience",
    "field.currentlyEmployed": "Currently Employed?",
    "field.currentTitle": "Current Job Title",
    "field.currentTasks": "Current Tasks Summary",
    "field.selfSummary": "Professional Summary (about you + current tasks + other experience)",
    "field.otherExperience": "Other Experience Outside Specialization",
    "ph.selfSummaryMerged": "Write a comprehensive summary covering: about you, your key past or current tasks, and any extra experience. If you're not currently employed, mention your qualifications and skills.",
    "field.arabicLevel": "Arabic Language Level",
    "field.englishLevel": "English Language Level",
    "field.otherLanguage": "Other Language",
    "field.linkedin": "LinkedIn Profile",

    // Financials
    "field.currentSalary": "Current Salary (SAR)",
    "field.expectedSalary": "Expected Salary (SAR)",
    "field.availableDate": "Expected Joining Date",
    "field.expectedJoinDate": "Expected Joining Date",

    // Attachments
    "field.resume": "Upload Resume",
    "field.degreeCopy": "Degree Copy (optional)",
    "field.trainingCerts": "Training Certificates (optional)",
    "field.otherDocs": "Any other certificate you want to attach (optional)",

    // Placeholders
    "ph.fullName": "Enter your full name",
    "ph.phone": "05XXXXXXXX",
    "ph.email": "example@email.com",
    "ph.city": "City",
    "ph.select": "Select...",
    "ph.major": "Enter your major",
    "ph.university": "University or institute name",
    "ph.graduationYear": "e.g. 2020",
    "ph.gpa": "e.g. 4.5 out of 5",
    "ph.currentStudy": "Current study description",
    "ph.currentTitle": "Job title",
    "ph.currentTasks": "Describe your main current tasks...",
    "ph.selfSummary": "Write a brief professional summary...",
    "ph.otherExperience": "Mention any additional experience...",
    "ph.otherLanguage": "Specify language and level",
    "ph.linkedin": "https://linkedin.com/in/...",
    "ph.salary": "e.g. 8000",
    "ph.dependents": "0",

    // Select options
    "opt.male": "Male",
    "opt.female": "Female",
    "opt.single": "Single",
    "opt.married": "Married",
    "opt.divorced": "Divorced",
    "opt.widowed": "Widowed",
    "opt.yes": "Yes",
    "opt.no": "No",
    "opt.fulltime": "Full-time",
    "opt.parttime": "Part-time",
    "opt.remote": "Remote",
    "opt.contract": "Contract",
    "opt.coop": "Co-op Training",
    "opt.tamheer": "Tamheer",
    "opt.immediate": "Immediate",
    "opt.oneWeek": "Within a week",
    "opt.twoWeeks": "Within two weeks",
    "opt.oneMonth": "Within a month",
    "opt.twoMonths": "Within two months",
    "opt.moreThanTwo": "More than two months",
    "opt.eastern": "Eastern Province",
    "opt.riyadh": "Riyadh",
    "opt.jeddah": "Jeddah",

    // Language levels
    "opt.excellent": "Excellent",
    "opt.veryGood": "Very Good",
    "opt.good": "Good",
    "opt.average": "Average",
    "opt.beginner": "Beginner",

    // hearAbout
    "opt.linkedin": "LinkedIn",
    "opt.twitter": "Twitter / X",
    "opt.website": "Company Website",
    "opt.friend": "Friend or Acquaintance",
    "opt.jobPlatform": "Job Platform",
    "opt.other": "Other",

    // Jobs page
    "jobs.title": "Job Openings",
    "jobs.desc": "Explore available career opportunities and join our distinguished team.",
    "jobs.noJobs": "No job openings available at this time",
    "jobs.applyNow": "Apply Now",
    "jobs.location": "Location",
    "jobs.type": "Job Type",
    "jobs.department": "Department",
    "jobs.postedOn": "Posted on",
    "jobs.available": "Available",
    "jobs.vacancies": "vacancy",
    "jobs.searchPlaceholder": "Search for a job...",
    "jobs.filter": "Filter",

    // Facility management question
    "field.facilityManagementExp": "Have you worked in maintenance, operations, or facilities management?",
    "opt.facilityYes": "Yes",
    "opt.facilityContractor": "I worked in contracting",
    "opt.facilityBoth": "I worked in both fields",
    "opt.facilityNo": "No, I haven't worked in either field",

    // Dashboard vacancy
    "dash.vacancyCount": "Vacancy Count",

    // Nav
    "nav.home": "Home",

    // Dashboard
    "dash.title": "HR Dashboard",
    "dash.totalApplicants": "Total Applicants",
    "dash.newApplicants": "New Applicants",
    "dash.inInterview": "In Interviews",
    "dash.hired": "Hired",
    "dash.applicants": "Applicants",
    "dash.search": "Search by name or position...",
    "dash.export": "Export Excel",
    "dash.status": "Status",
    "dash.name": "Name",
    "dash.position": "Position",
    "dash.city": "City",
    "dash.date": "Application Date",
    "dash.actions": "Actions",
    "dash.notes": "Notes",
    "dash.saveNotes": "Save Notes",
    "dash.updateStatus": "Update Status",
    "dash.viewDetails": "View Details",
    "dash.byStatus": "By Status",
    "dash.byPosition": "By Position",
    "dash.byCity": "By City",
    "dash.timeline": "Timeline",
    "dash.manageJobs": "Manage Jobs",
    "dash.addJob": "Add Job",
    "dash.login": "Login",
    "dash.email": "Email",
    "dash.password": "Password",
    "dash.loginBtn": "Sign In",
    "dash.loginError": "Invalid email or password",
    "dash.logout": "Logout",
    "dash.all": "All",
    "dash.filterStatus": "Filter by status",
    "dash.attachments": "Attachments",
    "dash.viewFile": "View File",
    "dash.noAttachments": "No attachments",
    "dash.manageUsers": "Manage Users",
    "dash.addUser": "Add User",
    "dash.role": "Role",
    "dash.projects": "Projects",
    "dash.addProject": "Add Project",
    "dash.editJob": "Edit Job",
    "dash.deleteJob": "Delete Job",
    "dash.jobTitle": "Job Title (Arabic)",
    "dash.jobTitleEn": "Job Title (English)",
    "dash.jobLocation": "Location",
    "dash.jobType": "Job Type",
    "dash.jobDept": "Department",
    "dash.jobDesc": "Job Description (Arabic)",
    "dash.jobDescEn": "Job Description (English)",
    "dash.jobReq": "Requirements (Arabic)",
    "dash.jobReqEn": "Requirements (English)",
    "dash.jobActive": "Active",
    "dash.jobInactive": "Inactive",
    "dash.save": "Save",
    "dash.cancel": "Cancel",
    "dash.confirm": "Confirm",
    "dash.saved": "Saved successfully",
    "dash.deleted": "Deleted",
    "dash.tab.applicants": "Applicants",
    "dash.tab.jobs": "Jobs",
    "dash.tab.users": "Users",
    "dash.tab.projects": "Projects",
    "dash.tab.analytics": "Analytics",
    "dash.signupEmail": "User Email",
    "dash.signupPassword": "Password",
    "dash.signupName": "Name",
    "dash.userAdded": "User added successfully",
    "dash.projectName": "Project Name (Arabic)",
    "dash.projectNameEn": "Project Name (English)",
    "dash.projectDesc": "Project Description",
    "dash.nationalityRequired": "Required Nationality",
    "dash.arabic": "Arabic",
    "dash.english": "English",

    // Job detail page
    "jobDetail.notFound": "Job not found",
    "jobDetail.backToJobs": "Back to Jobs",
    "jobDetail.viewDetails": "View Details",
    "jobDetail.description": "Job Description",
    "jobDetail.requirements": "Requirements",
    "jobDetail.experienceRequired": "Experience Required",
    "jobDetail.degreeRequired": "Degree Required",
    "jobDetail.additionalDetails": "Additional Details",
    "jobDetail.vacancies": "Vacancies",
    "jobDetail.interestedTitle": "Interested in this role?",
    "jobDetail.interestedDesc": "Apply now and join the NexHire AI team",
    "jobDetail.postedOn": "Posted on:",

    // Settings / Custom Questions
    "dash.tab.settings": "Settings",
    "dash.customQuestions": "Custom Questions",
    "dash.addQuestion": "Add Question",
    "dash.editQuestion": "Edit Question",
    "dash.questionAr": "Question (Arabic)",
    "dash.questionEn": "Question (English)",
    "dash.questionType": "Field Type",
    "dash.questionType.text": "Text",
    "dash.questionType.select": "Dropdown",
    "dash.questionType.textarea": "Long Text",
    "dash.optionsAr": "Options (Arabic) - comma separated",
    "dash.optionsEn": "Options (English) - comma separated",
    "dash.questionRequired": "Required",
    "dash.questionStep": "Form Step",
    "dash.questionOrder": "Sort Order",
    "dash.noQuestions": "No custom questions yet",

    // User management
    "dash.userEmail": "Email",
    "dash.userName": "Display Name",
    "dash.userRole": "Role",
    "dash.userStatus": "Status",
    "dash.userActive": "Active",
    "dash.userInactive": "Disabled",
    "dash.noUsers": "No users yet",
    "dash.confirmDelete": "Are you sure you want to delete this user?",
    "dash.userDeleted": "User deleted",
    "dash.roleUpdated": "Role updated",
    "dash.statusUpdated": "User status updated",
    "dash.displayName": "Display Name",

    // Roles
    "role.admin": "System Admin",
    "role.hr_manager": "HR Manager",
    "role.recruitment_coordinator": "Recruitment Coordinator",
    "role.project_manager": "Project Manager",

    // Statuses
    "status.new": "New",
    "status.reviewing": "Under Review",
    "status.phone_interview": "Phone Interview",
    "status.in_person_interview": "In-Person Interview",
    "status.accepted": "Hired",
    "status.hired": "Hired",
    "status.rejected": "Rejected",
    "status.withdrawn": "Withdrawn",

    // Training page
    "nav.training": "Co-op / Tamheer",
    "nav.track": "Track Application",
    "training.title": "Co-op Training & Tamheer Opportunities",
    "training.desc": "Join our Co-op and Tamheer training programs at NexHire AI",
    "training.noJobs": "No training opportunities available right now",
    "training.applyNow": "Apply for this opportunity",

    // Duplicate detection
    "dup.title": "Previous application detected",
    "dup.desc": "We found an existing application with the same name, email and mobile. Would you like to update your previous application instead?",
    "dup.update": "Update previous application",
    "dup.cancel": "Cancel",
    "dup.updated": "Your application has been updated successfully",
    "dup.identityMismatch": "Identity does not match",

    // Admin
    "admin.loginDesc": "HR & Management Team Portal",
    "admin.forgotPassword": "Forgot Password?",
    "admin.forgotDesc": "Enter your email and we'll send you a password reset link",
    "admin.sendReset": "Send Reset Link",
    "admin.resetSent": "A password reset link has been sent to your email. Please check your inbox.",
    "admin.resetError": "An error occurred. Please try again.",
    "admin.backToLogin": "Back to Login",
    "admin.newPassword": "New Password",
    "admin.newPasswordLabel": "New Password",
    "admin.confirmPassword": "Confirm Password",
    "admin.updatePassword": "Update Password",
    "admin.passwordUpdated": "Password updated successfully! Redirecting to login...",
    "admin.passwordMismatch": "Passwords do not match",
    "admin.passwordTooShort": "Password must be at least 6 characters",
    "admin.invalidResetLink": "Invalid or expired reset link",
    "admin.otpSent": "Login link sent to your email",
    "admin.otpSendError": "Failed to send login link. Try again.",
    "admin.otpInvalid": "Invalid or expired verification code",
    "admin.otpLabel": "Enter verification code",
    "admin.magicLinkDesc": "A login link has been sent to your email",
    "admin.checkEmailForLink": "Check your email and click the login link",
    "admin.clickLinkToLogin": "You will be logged in automatically after clicking the link",
    "admin.verifyOtp": "Verify",
    "admin.resendOtp": "Resend link",
    "admin.emailNotRegistered": "This email is not registered in the system",
    "admin.noAccess": "Access Denied",
    "admin.noAccessDesc": "Your account is registered but does not have permission to access the dashboard. Please contact a system administrator, or sign out and try a different account.",
    "admin.twoFactorTitle": "Two-Factor Verification",
    "admin.twoFactorDesc": "A verification code has been sent to your email",
    "admin.otpCodeSent": "Verification code sent to your email",
    "admin.otpCodeSendError": "Failed to send verification code. Try again.",
    "admin.resendCode": "Resend code",
  },
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem("akg-lang") as Lang) || "ar";
    } catch {
      return "ar";
    }
  });

  const handleSetLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem("akg-lang", l);
  };

  const t = (key: string) => translations[lang][key] || key;
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
