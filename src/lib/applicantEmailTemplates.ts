// قوالب إيميلات المرشحين — عربي/إنجليزي لكل حالة
// لا يتم الإرسال الفعلي حتى يتم ربط الدومين

export type ApplicantEmailStatus =
  | "reviewing"
  | "phone_interview"
  | "in_person_interview"
  | "accepted"
  | "hired"
  | "rejected";

export interface TemplateContext {
  fullName: string;
  positionAr?: string | null;
  positionEn?: string | null;
  companyAr: string;
  companyEn: string;
  rejectionReasonAr?: string | null;
  rejectionReasonEn?: string | null;
  rejectionNote?: string | null;
}

export interface RenderedEmail {
  subject: string;
  body: string;
}

const arPos = (c: TemplateContext) => c.positionAr || c.positionEn || "—";
const enPos = (c: TemplateContext) => c.positionEn || c.positionAr || "—";

const TEMPLATES_AR: Record<ApplicantEmailStatus, (c: TemplateContext) => RenderedEmail> = {
  reviewing: (c) => ({
    subject: `طلبك قيد المراجعة — ${c.companyAr}`,
    body: `الأستاذ/ة ${c.fullName}،\n\nنشكر تقدمك لشاغر "${arPos(c)}" لدى ${c.companyAr}.\nنود إعلامك بأن طلبك قيد المراجعة من قبل فريق الموارد البشرية، وسيتم التواصل معك بأي مستجدات.\n\nمع التقدير،\nفريق التوظيف — ${c.companyAr}`,
  }),
  phone_interview: (c) => ({
    subject: `دعوة لمقابلة هاتفية — ${c.companyAr}`,
    body: `الأستاذ/ة ${c.fullName}،\n\nيسرنا إعلامك بأنه تم تأهيلك لمرحلة المقابلة الهاتفية لشاغر "${arPos(c)}".\nسيتواصل معك أحد أعضاء فريقنا قريباً لتنسيق الموعد المناسب.\n\nمع التقدير،\nفريق التوظيف — ${c.companyAr}`,
  }),
  in_person_interview: (c) => ({
    subject: `دعوة لمقابلة شخصية — ${c.companyAr}`,
    body: `الأستاذ/ة ${c.fullName}،\n\nنبارك لك اجتيازك المرحلة السابقة، ويسعدنا دعوتك لمقابلة شخصية لشاغر "${arPos(c)}".\nسيتم التواصل معك لتحديد الموعد والمكان.\n\nمع التقدير،\nفريق التوظيف — ${c.companyAr}`,
  }),
  accepted: (c) => ({
    subject: `تهانينا — تم قبولك مبدئياً لدى ${c.companyAr}`,
    body: `الأستاذ/ة ${c.fullName}،\n\nيسرنا إبلاغك بأنه تم قبولك مبدئياً لشاغر "${arPos(c)}" لدى ${c.companyAr}.\nسيتم التواصل معك خلال الأيام القادمة لاستكمال الإجراءات.\n\nمع التقدير،\nفريق التوظيف — ${c.companyAr}`,
  }),
  hired: (c) => ({
    subject: `مرحباً بك في ${c.companyAr}`,
    body: `الأستاذ/ة ${c.fullName}،\n\nأهلاً وسهلاً بك ضمن عائلة ${c.companyAr} في وظيفة "${arPos(c)}".\nنتطلع للعمل معك ونتمنى لك التوفيق في مهامك الجديدة.\n\nمع التقدير،\nفريق التوظيف — ${c.companyAr}`,
  }),
  rejected: (c) => {
    const reason = c.rejectionReasonAr ? `\nسبب عدم الترشيح: ${c.rejectionReasonAr}` : "";
    const note = c.rejectionNote ? `\nملاحظة: ${c.rejectionNote}` : "";
    return {
      subject: `بخصوص طلبك لدى ${c.companyAr}`,
      body: `الأستاذ/ة ${c.fullName}،\n\nنشكر اهتمامك بالعمل لدى ${c.companyAr} وتقدمك لشاغر "${arPos(c)}".\nبعد دراسة طلبك بعناية، نعتذر عن عدم إمكانية ترشيحك في الوقت الحالي.${reason}${note}\n\nسيتم الاحتفاظ ببياناتك للرجوع إليها مستقبلاً عند توفر فرص مناسبة.\n\nمع التقدير،\nفريق التوظيف — ${c.companyAr}`,
    };
  },
};

const TEMPLATES_EN: Record<ApplicantEmailStatus, (c: TemplateContext) => RenderedEmail> = {
  reviewing: (c) => ({
    subject: `Your application is under review — ${c.companyEn}`,
    body: `Dear ${c.fullName},\n\nThank you for applying to the "${enPos(c)}" position at ${c.companyEn}.\nYour application is currently under review by our HR team. We will get back to you with any updates.\n\nBest regards,\nRecruitment Team — ${c.companyEn}`,
  }),
  phone_interview: (c) => ({
    subject: `Phone interview invitation — ${c.companyEn}`,
    body: `Dear ${c.fullName},\n\nWe are pleased to inform you that you have been shortlisted for a phone interview for the "${enPos(c)}" position.\nA member of our team will contact you shortly to schedule a convenient time.\n\nBest regards,\nRecruitment Team — ${c.companyEn}`,
  }),
  in_person_interview: (c) => ({
    subject: `In-person interview invitation — ${c.companyEn}`,
    body: `Dear ${c.fullName},\n\nCongratulations on passing the previous stage. We would like to invite you to an in-person interview for the "${enPos(c)}" position.\nWe will contact you to confirm the date and location.\n\nBest regards,\nRecruitment Team — ${c.companyEn}`,
  }),
  accepted: (c) => ({
    subject: `Congratulations — initial offer from ${c.companyEn}`,
    body: `Dear ${c.fullName},\n\nWe are delighted to inform you that you have been initially accepted for the "${enPos(c)}" position at ${c.companyEn}.\nWe will be in touch over the coming days to complete the next steps.\n\nBest regards,\nRecruitment Team — ${c.companyEn}`,
  }),
  hired: (c) => ({
    subject: `Welcome to ${c.companyEn}`,
    body: `Dear ${c.fullName},\n\nWelcome to the ${c.companyEn} family as our new "${enPos(c)}".\nWe look forward to working with you and wish you success in your new role.\n\nBest regards,\nRecruitment Team — ${c.companyEn}`,
  }),
  rejected: (c) => {
    const reason = c.rejectionReasonEn ? `\nReason: ${c.rejectionReasonEn}` : "";
    const note = c.rejectionNote ? `\nNote: ${c.rejectionNote}` : "";
    return {
      subject: `Regarding your application to ${c.companyEn}`,
      body: `Dear ${c.fullName},\n\nThank you for your interest in joining ${c.companyEn} and applying for the "${enPos(c)}" position.\nAfter careful review, we regret to inform you that we are unable to proceed with your application at this time.${reason}${note}\n\nYour information will be retained for future opportunities that match your profile.\n\nBest regards,\nRecruitment Team — ${c.companyEn}`,
    };
  },
};

export const renderApplicantEmail = (
  status: ApplicantEmailStatus,
  language: "ar" | "en",
  ctx: TemplateContext
): RenderedEmail => {
  const map = language === "en" ? TEMPLATES_EN : TEMPLATES_AR;
  return map[status](ctx);
};

export const STATUSES_WITH_EMAIL: ApplicantEmailStatus[] = [
  "reviewing",
  "phone_interview",
  "in_person_interview",
  "accepted",
  "hired",
  "rejected",
];
