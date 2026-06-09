import type { Lang } from "@/contexts/LanguageContext";

// Bilingual job positions: [Arabic, English]
const jobPositionsBilingual: [string, string][] = [
  ["مدير الموارد البشرية", "HR Manager"],
  ["مدير إدارة الموارد البشرية عام", "General HR Director"],
  ["الرئيس التنفيذي للموارد البشرية", "Chief Human Resources Officer"],
  ["شريك عمل موارد بشرية", "HR Business Partner"],
  ["مدير المكافآت والمزايا", "Compensation & Benefits Manager"],
  ["مدير التدريب والتطوير", "Training & Development Manager"],
  ["مدير عمليات الموارد البشرية", "HR Operations Manager"],
  ["منسق مشاريع", "Project Coordinator"],
  ["مسؤول إدارة المشاريع", "Project Management Officer"],
  ["مدير مشروع", "Project Manager"],
  ["مدير الخدمات المساندة", "Support Services Manager"],
  ["مشرف عمال", "Labor Supervisor"],
  ["مسؤول مراقبة الجودة", "Quality Control Officer"],
  ["مسؤول البيئة والصحة والسلامة", "EHS Officer"],
  ["أخصائي استقطاب مواهب وتوظيف", "Talent Acquisition & Recruitment Specialist"],
  ["أخصائي موارد بشرية أول", "Senior HR Specialist"],
  ["أخصائي أداء", "Performance Specialist"],
  ["أخصائي رواتب وتعويضات", "Payroll & Compensation Specialist"],
  ["أخصائي علاقات موظفين", "Employee Relations Specialist"],
  ["أخصائي عمليات الموارد البشرية", "HR Operations Specialist"],
  ["أخصائي امتثال قانوني وقانون عمل", "Legal Compliance & Labor Law Specialist"],
  ["أخصائي تطوير تنظيمي وإدارة تغيير", "Organizational Development & Change Management Specialist"],
  ["أخصائي منصات قوى ومدد وحوافز", "Qiwa, Mudad & Incentives Platform Specialist"],
  ["مسؤول علاقات حكومية", "Government Relations Officer"],
  ["أخصائي أنظمة معلومات الموارد البشرية", "HRIS Specialist"],
  ["مساعد إداري موارد بشرية", "HR Administrative Assistant"],
  ["منسق موارد بشرية", "HR Coordinator"],
  ["محلل بيانات موارد بشرية", "HR Data Analyst"],
  ["فني صيانة عامة", "General Maintenance Technician"],
  ["مهندس كهرباء", "Electrical Engineer"],
  ["مهندس ميكانيكا", "Mechanical Engineer"],
  ["مهندس مدني", "Civil Engineer"],
  ["مهندس إداري", "Administrative Engineer"],
  ["مشغل رافعة", "Crane Operator"],
  ["فني تكييف وتبريد", "HVAC Technician"],
  ["فني تمديدات صحية", "Plumbing Technician"],
  ["فني كهربائي", "Electrical Technician"],
  ["سباك", "Plumber"],
  ["صباغ مباني", "Building Painter"],
  ["حداد", "Blacksmith"],
  ["لحام أرغون", "Argon Welder"],
  ["بلاط ورخام", "Tiler & Marble Worker"],
  ["نجار", "Carpenter"],
  ["عامل خدمات عامة", "General Services Worker"],
  ["عامل نظافة صناعية", "Industrial Cleaner"],
  ["عامل شحن وتفريغ", "Loading & Unloading Worker"],
  ["موظف استقبال", "Receptionist"],
  ["مدخل بيانات", "Data Entry Clerk"],
  ["أخصائي تسويق رقمي", "Digital Marketing Specialist"],
  ["أخصائي نظم وبنية تحتية تقنية", "IT Systems & Infrastructure Specialist"],
  ["قائد فريق تكنولوجيا المعلومات", "IT Team Lead"],
  ["قائد فريق تطوير البرمجيات", "Software Development Team Lead"],
  ["قائد فريق عمليات الشبكة", "Network Operations Team Lead"],
  ["قائد فريق الأمن السيبراني", "Cybersecurity Team Lead"],
  ["قائد فريق تحليل البيانات", "Data Analytics Team Lead"],
  ["قائد فريق البنية التحتية السحابية", "Cloud Infrastructure Team Lead"],
  ["قائد فريق الذكاء الاصطناعي", "AI Team Lead"],
  ["مطور حلول اتصال صوتي", "Voice Communication Solutions Developer"],
  ["مطور تقنية معلومات", "IT Developer"],
  ["أخصائي تطوير تطبيقات", "Application Development Specialist"],
  ["أخصائي ذكاء اصطناعي", "AI Specialist"],
  ["مدير مشروع تقني", "Technical Project Manager"],
  ["مدقق داخلي", "Internal Auditor"],
  ["مهندس دعم شبكات", "Network Support Engineer"],
  ["مهندس شبكات", "Network Engineer"],
  ["خدمة عملاء", "Customer Service"],
  ["مشرف خدمة عملاء", "Customer Service Supervisor"],
  ["أخصائي تقارير", "Reporting Specialist"],
  ["صيدلي/ة", "Pharmacist"],
  ["مشرف/ة صيادلة", "Pharmacy Supervisor"],
  ["أخصائي/ة نفسي", "Psychologist"],
  ["مترجم/ة لغة إشارة", "Sign Language Interpreter"],
  ["أخصائي/ة مبيعات قطاع أعمال", "B2B Sales Specialist"],
  ["مدير/ة تكنولوجيا المعلومات", "IT Manager"],
  ["فني/ة حاسب", "Computer Technician"],
  ["أخصائي/ة دعم فني", "Technical Support Specialist"],
  ["أخصائي/ة أمن سيبراني", "Cybersecurity Specialist"],
  ["محلل/ة أعمال", "Business Analyst"],
  ["أخصائي/ة توظيف", "Recruitment Specialist"],
  ["مصمم/ة جرافيك", "Graphic Designer"],
  ["أخصائي/ة تواصل اجتماعي", "Social Media Specialist"],
  ["محلل مالي", "Financial Analyst"],
  ["مدير مالي", "Finance Manager"],
  ["محاسب عام", "General Accountant"],
  ["مدقق حسابات", "Auditor"],
  ["مدير عمليات", "Operations Manager"],
  ["أخصائي ضبط جودة", "Quality Assurance Specialist"],
  ["أخصائي قوى عاملة", "Workforce Specialist"],
  ["أخصائي تسويق", "Marketing Specialist"],
  ["محرر محتوى", "Content Editor"],
  ["كاتب محتوى", "Content Writer"],
  ["سكرتير تنفيذي", "Executive Secretary"],
  ["محلل بيانات (Intern)", "Data Analyst (Intern)"],
  ["AI Engineer", "AI Engineer"],
  ["Laravel Developer", "Laravel Developer"],
  ["Software Developer", "Software Developer"],
  ["Software Engineer", "Software Engineer"],
  ["Junior Developer", "Junior Developer"],
  ["Content Creator", "Content Creator"],
  ["مدير مشروع التعبئة", "Mobilization Project Manager"],
  ["إداري تعبئة", "Mobilization Administrator"],
  ["موظف مشتريات", "Procurement Officer"],
  ["مشرف كهرباء", "Electrical Supervisor"],
  ["مشرف مدني", "Civil Supervisor"],
  ["عامل تنظيف", "Cleaning Worker"],
  ["مراقب مستندات", "Document Controller"],
  ["سائق", "Driver"],
  ["مسؤول أول بيئة وصحة وسلامة", "Senior EHS Officer"],
  ["مدير نظام إدارة الصيانة CAFM", "CAFM Maintenance System Manager"],
  ["موظف مكتب مساعدة CAFM", "CAFM Help Desk Officer"],
  ["إداري مشروع", "Project Administrator"],
  ["منسق مشروع", "Project Coordinator"],
  ["موظف ضبط جودة", "Quality Control Officer"],
  ["موظف لوجستيات معدات وأدوات", "Equipment & Tools Logistics Officer"],
  ["مسؤول أول مشتريات", "Senior Procurement Officer"],
  ["رسام أوتوكاد ونظم معلومات جغرافية", "AutoCAD & GIS Draftsman"],
  ["منسق موظفين", "Staff Coordinator"],
  ["أمين مستودع", "Warehouse Keeper"],
  ["فني مخازن", "Warehouse Technician"],
  ["مدير حزمة الخدمات الهندسية", "Hard Services Package Manager"],
  ["مهندس ميكانيك", "Mechanical Engineer"],
  ["مشرف أعمال مدنية", "Civil Works Supervisor"],
  ["مشرف ميكانيك", "Mechanical Supervisor"],
  ["بناء", "Mason"],
  ["مساعد بناء", "Mason Assistant"],
  ["دهان", "Painter"],
  ["كهربائي نوبات", "Shift Electrician"],
  ["مساعد كهربائي نوبات", "Shift Electrician Assistant"],
  ["مساعد كهربائي", "Electrician Assistant"],
  ["سباك عام", "General Plumber"],
  ["مساعد سباك", "Plumber Assistant"],
  ["فني مضخات", "Pump Technician"],
  ["لحام", "Welder"],
  ["ميكانيكي صيانة وإصلاح", "Maintenance & Repair Mechanic"],
  ["ميكانيكي عام", "General Mechanic"],
  ["مدير حزمة الخدمات اللينة", "Soft Services Package Manager"],
  ["مشرف نظافة نوبات", "Shift Cleaning Supervisor"],
  ["قائد فريق نظافة نوبات", "Shift Cleaning Team Lead"],
  ["قائد فريق نظافة", "Cleaning Team Lead"],
  ["عامل نظافة عامة", "General Cleaner"],
  ["عامل نظافة نوبات", "Shift Cleaner"],
  ["سائق سيارة صالون", "Sedan Driver"],
  ["سائق بيك آب دفع رباعي", "4WD Pickup Driver"],
  ["سائق شاحنة دينا", "Dyna Truck Driver"],
  ["سائق شاحنة رافعة كرين", "Crane Truck Driver"],
  ["مشغل جرافة هيدروليكية", "Hydraulic Excavator Operator"],
  ["مشغل مدحلة رص", "Compaction Roller Operator"],
  ["مشغل رافعة تلسكوبية", "Telescopic Crane Operator"],
  ["مشغل جرافة صغيرة بوبكات", "Bobcat Skid Loader Operator"],
  ["مشغل مكنسة طرق آلية", "Road Sweeper Operator"],
  ["مشغل غسالة طرق آلية", "Road Washer Operator"],
  ["مشغل مكنسة وجلاية أرضيات", "Floor Sweeper & Scrubber Operator"],
  ["سائق صهريج مياه مع مضخة شفط", "Water Tanker Driver with Suction Pump"],
  ["سائق صهريج مياه تزويد", "Water Supply Tanker Driver"],
];

// Export Arabic-only list for backward compat
export const jobPositions = jobPositionsBilingual.map(([ar]) => ar);

// Get bilingual positions
export const getJobPositions = (lang: Lang): string[] =>
  lang === "ar"
    ? jobPositionsBilingual.map(([ar]) => ar)
    : jobPositionsBilingual.map(([, en]) => en);

// Get a mapping from Arabic to English and vice versa
export const getJobPositionTranslation = (position: string, toLang: Lang): string => {
  if (toLang === "en") {
    const found = jobPositionsBilingual.find(([ar]) => ar === position);
    return found ? found[1] : position;
  } else {
    const found = jobPositionsBilingual.find(([, en]) => en === position);
    return found ? found[0] : position;
  }
};

// Full nationalities list
const nationalitiesData: Record<Lang, string[]> = {
  ar: [
    "أفغانستان", "الأرجنتين", "الأردن", "الإمارات العربية المتحدة", "إندونيسيا",
    "إيران", "إريتريا", "إسبانيا", "أستراليا", "إستونيا", "إفريقيا الوسطى",
    "الألبان", "البحرين", "البرتغال", "البوسنة والهرسك", "الجزائر", "السودان",
    "السويد", "الصومال", "الصين", "العراق", "الفلبين", "المغرب", "المكسيك",
    "المملكة المتحدة", "المملكة العربية السعودية", "النرويج", "الهند",
    "الولايات المتحدة الأمريكية", "اليابان", "اليمن", "اليونان", "أذربيجان",
    "أرمينيا", "أوكرانيا", "إثيوبيا", "إيطاليا", "بابوا غينيا الجديدة",
    "باكستان", "باراغواي", "البرازيل", "بنغلاديش", "بنما", "بلجيكا", "بلغاريا",
    "بولندا", "بيرو", "تايلاند", "تايوان", "تركمانستان", "تركيا", "تشاد",
    "تشيلي", "تونس", "جيبوتي", "جنوب أفريقيا", "جنوب السودان", "جورجيا",
    "دومينيكا", "روسيا", "رواندا", "رومانيا", "زامبيا", "زيمبابوي",
    "ساحل العاج", "ساموا", "سلطنة عمان", "سنغافورة", "سوريا", "سلوفاكيا",
    "سلوفينيا", "سويسرا", "طاجيكستان", "فلسطين", "قطر", "كازاخستان",
    "كرواتيا", "كمبوديا", "كندا", "كوبا", "كوريا الجنوبية", "كوريا الشمالية",
    "كوستاريكا", "كولومبيا", "كينيا", "لبنان", "ليبيا", "مالاوي", "ماليزيا",
    "مالطا", "مصر", "موريتانيا", "موزمبيق", "موناكو", "موريشيوس", "ميانمار",
    "ناميبيا", "نيبال", "نيجيريا", "نيوزيلندا", "هولندا", "هنغاريا", "هايتي",
    "الكويت", "أخرى",
  ],
  en: [
    "Afghanistan", "Argentina", "Jordan", "United Arab Emirates", "Indonesia",
    "Iran", "Eritrea", "Spain", "Australia", "Estonia", "Central Africa",
    "Albania", "Bahrain", "Portugal", "Bosnia and Herzegovina", "Algeria", "Sudan",
    "Sweden", "Somalia", "China", "Iraq", "Philippines", "Morocco", "Mexico",
    "United Kingdom", "Saudi Arabia", "Norway", "India",
    "United States of America", "Japan", "Yemen", "Greece", "Azerbaijan",
    "Armenia", "Ukraine", "Ethiopia", "Italy", "Papua New Guinea",
    "Pakistan", "Paraguay", "Brazil", "Bangladesh", "Panama", "Belgium", "Bulgaria",
    "Poland", "Peru", "Thailand", "Taiwan", "Turkmenistan", "Turkey", "Chad",
    "Chile", "Tunisia", "Djibouti", "South Africa", "South Sudan", "Georgia",
    "Dominica", "Russia", "Rwanda", "Romania", "Zambia", "Zimbabwe",
    "Ivory Coast", "Samoa", "Oman", "Singapore", "Syria", "Slovakia",
    "Slovenia", "Switzerland", "Tajikistan", "Palestine", "Qatar", "Kazakhstan",
    "Croatia", "Cambodia", "Canada", "Cuba", "South Korea", "North Korea",
    "Costa Rica", "Colombia", "Kenya", "Lebanon", "Libya", "Malawi", "Malaysia",
    "Malta", "Egypt", "Mauritania", "Mozambique", "Monaco", "Mauritius", "Myanmar",
    "Namibia", "Nepal", "Nigeria", "New Zealand", "Netherlands", "Hungary", "Haiti",
    "Kuwait", "Other",
  ],
};

const saudiCitiesData: Record<Lang, string[]> = {
  ar: [
    "لا أسكن بالسعودية",
    "الرياض", "الخرج", "المجمعة", "الدرعية", "الدوادمي", "القويعية", "وادي الدواسر",
    "مكة المكرمة", "جدة", "الطائف", "القنفذة", "الليث", "رابغ",
    "المدينة المنورة", "ينبع", "العلا", "بدر",
    "الدمام", "الخبر", "الظهران", "الأحساء", "حفر الباطن", "الجبيل", "القطيف", "الخفجي",
    "بريدة", "عنيزة", "الرس", "البكيرية",
    "أبها", "خميس مشيط", "بيشة", "محايل عسير",
    "تبوك", "الوجه", "ضباء",
    "حائل",
    "عرعر", "رفحاء", "طريف",
    "جازان", "صبيا", "أبو عريش",
    "نجران",
    "الباحة",
    "سكاكا",
  ],
  en: [
    "I don't live in Saudi Arabia",
    "Riyadh", "Al Kharj", "Al Majmaah", "Diriyah", "Al Dawadmi", "Al Quway'iyah", "Wadi Al Dawasir",
    "Makkah", "Jeddah", "Taif", "Al Qunfudhah", "Al Lith", "Rabigh",
    "Madinah", "Yanbu", "Al Ula", "Badr",
    "Dammam", "Khobar", "Dhahran", "Al Ahsa", "Hafar Al Batin", "Jubail", "Qatif", "Khafji",
    "Buraydah", "Unayzah", "Ar Rass", "Al Bukayriyah",
    "Abha", "Khamis Mushait", "Bisha", "Muhayil Asir",
    "Tabuk", "Al Wajh", "Duba",
    "Hail",
    "Arar", "Rafha", "Turaif",
    "Jazan", "Sabya", "Abu Arish",
    "Najran",
    "Al Baha",
    "Sakaka",
  ],
};

const educationLevelsData: Record<Lang, string[]> = {
  ar: ["دكتوراه", "ماجستير", "بكالوريوس", "دبلوم", "ثانوية عامة", "أقل من ثانوية"],
  en: ["Doctorate", "Master's", "Bachelor's", "Diploma", "High School", "Below High School"],
};

export const getNationalities = (lang: Lang) => nationalitiesData[lang];
export const getSaudiCities = (lang: Lang) => saudiCitiesData[lang];
export const getEducationLevels = (lang: Lang) => educationLevelsData[lang];

export const getYearsOfExperience = (lang: Lang) => [
  ...Array.from({ length: 30 }, (_, i) => 
    lang === "ar" ? `${i + 1} سنة` : `${i + 1} year${i + 1 > 1 ? "s" : ""}`
  ),
  lang === "ar" ? "أعلى من 30 سنة" : "More than 30 years",
];

export const getSalaryRanges = (lang: Lang) => [
  ...Array.from({ length: 50 }, (_, i) => {
    const from = (i * 1000 + 1000).toLocaleString("en-US");
    const to = (i * 1000 + 1999).toLocaleString("en-US");
    return lang === "ar" 
      ? `${from} إلى ${to} ريال`
      : `${from} to ${to} SAR`;
  }),
  lang === "ar" ? "أعلى من 50,000 ريال" : "More than 50,000 SAR",
];

// Keep backward compat exports
export const nationalities = nationalitiesData.ar;
export const cities = saudiCitiesData.ar;
export const yearsOfExperience = getYearsOfExperience("ar");
export const salaryRanges = getSalaryRanges("ar");
export const educationLevels = educationLevelsData.ar;
export const languageLevels = ["ممتاز", "جيد جداً", "جيد", "متوسط", "مبتدئ"];
export const hearAboutUs = ["LinkedIn", "تويتر / X", "موقع الشركة", "صديق أو معارف", "منصة توظيف", "أخرى"];

// Additional dropdown defaults for admin management
const genderData: Record<Lang, string[]> = {
  ar: ["ذكر", "أنثى"],
  en: ["Male", "Female"],
};
export const getGenderOptions = (lang: Lang) => genderData[lang];

const maritalStatusData: Record<Lang, string[]> = {
  ar: ["أعزب/عزباء", "متزوج/ة", "مطلق/ة", "أرمل/ة"],
  en: ["Single", "Married", "Divorced", "Widowed"],
};
export const getMaritalStatusOptions = (lang: Lang) => maritalStatusData[lang];

const yesNoData: Record<Lang, string[]> = {
  ar: ["نعم", "لا"],
  en: ["Yes", "No"],
};
export const getYesNoOptions = (lang: Lang) => yesNoData[lang];

const languageLevelData: Record<Lang, string[]> = {
  ar: ["ممتاز", "جيد جداً", "جيد", "متوسط", "مبتدئ"],
  en: ["Excellent", "Very Good", "Good", "Average", "Beginner"],
};
export const getLanguageLevels = (lang: Lang) => languageLevelData[lang];

const jobTypeData: Record<Lang, string[]> = {
  ar: ["دوام كامل", "دوام جزئي", "عن بُعد", "عقد مؤقت", "تدريب تعاوني", "تمهير"],
  en: ["Full-time", "Part-time", "Remote", "Contract", "Co-op Training", "Tamheer"],
};
export const getJobTypes = (lang: Lang) => jobTypeData[lang];

const hearAboutData: Record<Lang, string[]> = {
  ar: ["LinkedIn", "تويتر / X", "موقع الشركة", "صديق أو معارف", "منصة توظيف", "أخرى"],
  en: ["LinkedIn", "Twitter / X", "Company Website", "Friend or Acquaintance", "Job Platform", "Other"],
};
export const getHearAboutOptions = (lang: Lang) => hearAboutData[lang];

const availableDateData: Record<Lang, string[]> = {
  ar: ["فوري", "خلال أسبوع", "خلال أسبوعين", "خلال شهر", "خلال شهرين", "أكثر من شهرين"],
  en: ["Immediate", "Within a week", "Within two weeks", "Within a month", "Within two months", "More than two months"],
};
export const getAvailableDates = (lang: Lang) => availableDateData[lang];

const facilityMgmtData: Record<Lang, string[]> = {
  ar: ["نعم", "عملت في مجال المقاولات", "عملت في كل من المجالين", "لا، لم أعمل في أي من المجالين"],
  en: ["Yes", "I worked in contracting", "I worked in both fields", "No, I haven't worked in either field"],
};
export const getFacilityMgmtOptions = (lang: Lang) => facilityMgmtData[lang];
