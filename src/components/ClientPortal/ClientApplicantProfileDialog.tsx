import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Award, Briefcase, Calendar, Car, Download, FileText, GraduationCap, Languages as LanguagesIcon,
  Linkedin, Loader2, Lock, Mail, MapPin, MessageCircle, Phone, Sparkles, Unlock, User, Users, Wallet,
} from "lucide-react";
import {
  useClientApplicantProfileQuery,
  useClientResumeSummaryQuery,
  useRevealCandidateMutation,
  useSimilarCandidatesQuery,
  type ClientApplicantProfile,
} from "@/hooks/queries/useClientPortalSearch";
import ClientCandidateWorkspacePanel from "@/components/ClientPortal/ClientCandidateWorkspacePanel";

interface ClientApplicantProfileDialogProps {
  lang: "ar" | "en";
  applicantId: string | null;
  onClose: () => void;
  /** Lets the "similar candidates" strip swap the dialog to another applicant
   * without closing it first -- omit to hide that affordance (e.g. if a host
   * page doesn't want to support jumping between profiles). */
  onSelectApplicant?: (id: string) => void;
}

const dash = (v: string | null | undefined) => (v && String(v).trim() ? v : null);

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
}

// Saudi local numbers are stored as "05XXXXXXXX" -- wa.me needs the full
// international form with no leading zero (+966...).
function toWhatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const international = digits.startsWith("0") ? `966${digits.slice(1)}` : digits.startsWith("966") ? digits : `966${digits}`;
  return `https://wa.me/${international}`;
}

// A representative set of profile fields (mirrors what's actually rendered
// below) used to compute a rough "how filled-in is this CV" percentage --
// helps a client prioritize which candidates are worth revealing first.
// Deliberately excludes phone/email/résumé/linkedin (credit-gated, not
// filled-in-ness -- linkedin uses has_linkedin instead, which survives
// masking) and internal fields.
const COMPLETENESS_FIELDS: (keyof ClientApplicantProfile)[] = [
  "gender", "nationality", "birth_date", "marital_status", "current_city", "preferred_city",
  "has_transport", "education_level", "major", "university", "graduation_year", "gpa",
  "desired_position", "job_type", "years_experience", "currently_employed", "current_title",
  "current_salary", "expected_salary", "available_date", "current_tasks", "other_experience",
  "arabic_level", "english_level", "other_language", "self_summary",
];

function profileCompleteness(data: ClientApplicantProfile): number {
  const filled = COMPLETENESS_FIELDS.filter((f) => dash(data[f] as string | null)).length + (data.has_linkedin ? 1 : 0);
  return Math.round((filled / (COMPLETENESS_FIELDS.length + 1)) * 100);
}

/** One label/value row, only rendered when the value is present -- the profile
 * is built entirely from optional fields, so every row/section here quietly
 * disappears rather than showing an empty dash, keeping the layout dense and
 * CV-like instead of a grid full of placeholders. Doubles as a grid cell when
 * a parent wraps a group of these in a 2-column grid. */
function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

/** Card wrapper used for every profile section -- an icon badge + title
 * header over a bordered card, the building block of the CV-style layout. */
function ProfileCard({
  icon: Icon, title, children, className,
}: { icon: React.ElementType; title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/** Circular progress ring showing profile completeness -- a quick visual
 * signal (vs. the old plain-text badge) of how filled-in this CV is. */
function CompletenessRing({ percent, size = 46 }: { percent: number; size?: number }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`${percent}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="stroke-muted" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-500" fill="none"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{percent}%</div>
    </div>
  );
}

/** Small "locked until reveal" placeholder used for the gated fields
 * (contact block) -- consistent visual language for "pay to unlock". */
function LockedField({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Lock className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

/**
 * Client-facing full applicant profile -- Bayt.com-style: the ENTIRE CV is
 * browsable for free (education, experience, languages, salary
 * expectations, supporting documents), same as client-search-applicants'
 * results list. Only phone, email, LinkedIn, and the résumé PDF itself are
 * credit-gated -- masked/withheld until this org has revealed this
 * applicant, with a reveal CTA right here so a client doesn't have to close
 * the dialog and go find the row again. Laid out as a proper CV: a banner
 * header with a completeness ring, then a two-column grid of card sections
 * (contact/facts/languages on the side, summary/education/experience as the
 * main content) instead of one long stacked list.
 */
export default function ClientApplicantProfileDialog({ lang, applicantId, onClose, onSelectApplicant }: ClientApplicantProfileDialogProps) {
  const ar = lang === "ar";
  const { data, isLoading } = useClientApplicantProfileQuery(applicantId, lang);
  const revealMutation = useRevealCandidateMutation(lang);

  // Prefer matching by desired_position, then major, then current_city --
  // whichever the profile actually has filled in first.
  const similarField = data?.desired_position ? "desired_position" : data?.major ? "major" : data?.current_city ? "current_city" : null;
  const similarValue = similarField === "desired_position" ? data?.desired_position : similarField === "major" ? data?.major : data?.current_city;
  const { data: similarCandidates } = useSimilarCandidatesQuery(applicantId, similarField, similarValue ?? null, lang);

  // Opt-in (not auto-fired on open) -- generation costs a real AI call the
  // first time any org requests it for a given applicant+language; after
  // that it's served from applicant_ai_summaries, essentially free. Resets
  // when the dialog jumps to a different candidate via "similar candidates".
  const [showAiSummary, setShowAiSummary] = useState(false);
  useEffect(() => {
    setShowAiSummary(false);
  }, [applicantId]);
  const { data: aiSummary, isFetching: aiSummaryLoading, isError: aiSummaryError } = useClientResumeSummaryQuery(
    applicantId,
    showAiSummary,
    lang
  );

  const lockedLabel = ar ? "مقفول — بعد الكشف" : "Locked — after reveal";

  return (
    <Dialog open={!!applicantId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0 gap-0 max-h-[85vh] overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{ar ? "الملف الكامل للمرشح" : "Candidate full profile"}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-xl" />
                ))}
              </div>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[85vh]">
            <div dir={ar ? "rtl" : "ltr"}>
              {/* Banner header */}
              <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-6 pb-5 border-b">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold ring-4 ring-background shadow-sm">
                    {initials(data.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold truncate">{data.full_name}</h2>
                        {dash(data.desired_position) && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">{data.desired_position}</p>
                        )}
                      </div>
                      <CompletenessRing percent={profileCompleteness(data)} />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {dash(data.job_type) && <Badge variant="secondary" className="text-[10px]">{data.job_type}</Badge>}
                      {dash(data.currently_employed) && <Badge variant="outline" className="text-[10px]">{data.currently_employed}</Badge>}
                      {dash(data.current_city) && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <MapPin className="h-2.5 w-2.5" />{data.current_city}
                        </Badge>
                      )}
                      {dash(data.years_experience) && (
                        <Badge variant="outline" className="text-[10px]">
                          {ar ? `خبرة ${data.years_experience}` : `${data.years_experience} experience`}
                        </Badge>
                      )}
                      {data.is_revealed && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-emerald-600/40 text-emerald-600">
                          <Unlock className="h-2.5 w-2.5" />{ar ? "مكشوف" : "Unlocked"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 items-start">
                {/* ---- Left column: contact (gated), workspace, quick facts, languages, documents ---- */}
                <div className="space-y-4">
                  <ProfileCard icon={Phone} title={ar ? "بيانات التواصل" : "Contact"}>
                    <div className="space-y-1">
                      {dash(data.phone) ? (
                        <InfoRow icon={Phone} label={ar ? "الهاتف" : "Phone"} value={data.phone} />
                      ) : (
                        <LockedField label={ar ? "الهاتف" : "Phone"} />
                      )}
                      {data.is_revealed && dash(data.phone) && (
                        <Button size="sm" variant="outline" className="w-full gap-1.5 text-emerald-600 border-emerald-600/40 hover:bg-emerald-600/10" asChild>
                          <a href={toWhatsAppLink(data.phone!)} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-3.5 w-3.5" />
                            {ar ? "واتساب" : "WhatsApp"}
                          </a>
                        </Button>
                      )}
                      {dash(data.email) ? (
                        <InfoRow icon={Mail} label={ar ? "الإيميل" : "Email"} value={data.email} />
                      ) : (
                        <LockedField label={ar ? "الإيميل" : "Email"} />
                      )}

                      <div className="flex items-center gap-2.5 py-1.5">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">{ar ? "السيرة الذاتية" : "Résumé"}</p>
                          {!data.has_resume ? (
                            <p className="text-sm text-muted-foreground">{ar ? "لا يوجد ملف مرفوع" : "No file uploaded"}</p>
                          ) : data.is_revealed && data.resume_url ? (
                            <Button size="sm" variant="outline" className="mt-1 w-full" asChild>
                              <a href={data.resume_url} target="_blank" rel="noopener noreferrer">
                                <Download className="h-3.5 w-3.5 ms-1.5" />
                                {ar ? "تحميل السيرة الذاتية" : "Download résumé"}
                              </a>
                            </Button>
                          ) : (
                            <p className="text-sm text-muted-foreground">{lockedLabel}</p>
                          )}
                        </div>
                      </div>

                      {data.has_linkedin && (
                        <div className="flex items-center gap-2.5 py-1.5">
                          <Linkedin className="h-4 w-4 shrink-0 text-muted-foreground" />
                          {data.is_revealed && dash(data.linkedin) ? (
                            data.linkedin!.startsWith("http") ? (
                              <a href={data.linkedin!} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline break-all">
                                {ar ? "الملف الشخصي على لينكدإن" : "LinkedIn profile"}
                              </a>
                            ) : (
                              <span className="text-sm">{data.linkedin}</span>
                            )
                          ) : (
                            <span className="text-sm text-muted-foreground">{lockedLabel}</span>
                          )}
                        </div>
                      )}

                      {!data.is_revealed && (
                        <Button
                          size="sm"
                          className="w-full mt-1"
                          disabled={revealMutation.isPending}
                          onClick={() => revealMutation.mutate(data.id)}
                        >
                          {revealMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin ms-1.5" />
                          ) : (
                            <Unlock className="h-3.5 w-3.5 ms-1.5" />
                          )}
                          {ar ? "كشف بيانات التواصل" : "Reveal contact info"}
                        </Button>
                      )}
                    </div>
                  </ProfileCard>

                  <ClientCandidateWorkspacePanel lang={lang} applicantId={data.id} />

                  {(dash(data.gender) || dash(data.nationality) || dash(data.birth_date) || dash(data.marital_status) ||
                    dash(data.current_city) || dash(data.preferred_city) || dash(data.has_transport)) && (
                    <ProfileCard icon={User} title={ar ? "معلومات شخصية" : "Personal Information"}>
                      <div className="grid grid-cols-1 gap-x-3">
                        <InfoRow icon={User} label={ar ? "الجنس" : "Gender"} value={dash(data.gender)} />
                        <InfoRow icon={User} label={ar ? "الجنسية" : "Nationality"} value={dash(data.nationality)} />
                        <InfoRow icon={Calendar} label={ar ? "تاريخ الميلاد" : "Birth Date"} value={dash(data.birth_date)} />
                        <InfoRow icon={User} label={ar ? "الحالة الاجتماعية" : "Marital Status"} value={dash(data.marital_status)} />
                        <InfoRow icon={MapPin} label={ar ? "المدينة الحالية" : "Current City"} value={dash(data.current_city)} />
                        <InfoRow icon={MapPin} label={ar ? "المدينة المفضلة" : "Preferred City"} value={dash(data.preferred_city)} />
                        <InfoRow icon={Car} label={ar ? "وسيلة نقل" : "Transportation"} value={dash(data.has_transport)} />
                      </div>
                    </ProfileCard>
                  )}

                  {(dash(data.arabic_level) || dash(data.english_level) || dash(data.other_language)) && (
                    <ProfileCard icon={LanguagesIcon} title={ar ? "اللغات" : "Languages"}>
                      <InfoRow icon={LanguagesIcon} label={ar ? "العربية" : "Arabic"} value={dash(data.arabic_level)} />
                      <InfoRow icon={LanguagesIcon} label={ar ? "الإنجليزية" : "English"} value={dash(data.english_level)} />
                      <InfoRow icon={LanguagesIcon} label={ar ? "لغة أخرى" : "Other Language"} value={dash(data.other_language)} />
                    </ProfileCard>
                  )}

                  {(dash(data.degree_url) || dash(data.experience_cert_url) || dash(data.training_certs_url) || dash(data.other_docs_url)) && (
                    <ProfileCard icon={FileText} title={ar ? "مستندات إضافية" : "Additional Documents"}>
                      <div className="flex flex-wrap gap-2">
                        {dash(data.degree_url) && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={data.degree_url!} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-3.5 w-3.5 ms-1.5" />
                              {ar ? "صورة المؤهل" : "Degree Copy"}
                            </a>
                          </Button>
                        )}
                        {dash(data.experience_cert_url) && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={data.experience_cert_url!} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-3.5 w-3.5 ms-1.5" />
                              {ar ? "شهادة الخبرة" : "Experience Certificate"}
                            </a>
                          </Button>
                        )}
                        {dash(data.training_certs_url) && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={data.training_certs_url!} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-3.5 w-3.5 ms-1.5" />
                              {ar ? "شهادات تدريبية" : "Training Certificates"}
                            </a>
                          </Button>
                        )}
                        {dash(data.other_docs_url) && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={data.other_docs_url!} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-3.5 w-3.5 ms-1.5" />
                              {ar ? "مستندات أخرى" : "Other Documents"}
                            </a>
                          </Button>
                        )}
                      </div>
                    </ProfileCard>
                  )}
                </div>

                {/* ---- Right column: AI summary, self summary, education, experience, similar ---- */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-4">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                        {ar ? "ملخص ذكي (AI)" : "AI Summary"}
                      </span>
                      {!showAiSummary && (
                        <Button size="sm" variant="outline" onClick={() => setShowAiSummary(true)}>
                          {ar ? "توليد الملخص" : "Generate"}
                        </Button>
                      )}
                    </div>
                    {showAiSummary && (
                      aiSummaryLoading ? (
                        <div className="space-y-1.5 mt-1.5">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-2/3" />
                        </div>
                      ) : aiSummaryError ? (
                        <p className="text-xs text-destructive mt-1">{ar ? "تعذر توليد الملخص" : "Failed to generate summary"}</p>
                      ) : aiSummary ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap mt-1.5">{aiSummary.summary}</p>
                      ) : null
                    )}
                  </div>

                  {dash(data.self_summary) && (
                    <ProfileCard icon={User} title={ar ? "نبذة مختصرة" : "Summary"}>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{data.self_summary}</p>
                    </ProfileCard>
                  )}

                  {(dash(data.education_level) || dash(data.major) || dash(data.university)) && (
                    <ProfileCard icon={GraduationCap} title={ar ? "التعليم" : "Education"}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                        <InfoRow icon={GraduationCap} label={ar ? "المؤهل العلمي" : "Education Level"} value={dash(data.education_level)} />
                        <InfoRow icon={GraduationCap} label={ar ? "التخصص" : "Major"} value={dash(data.major)} />
                        <InfoRow icon={GraduationCap} label={ar ? "الجامعة" : "University"} value={dash(data.university)} />
                        <InfoRow icon={Calendar} label={ar ? "سنة التخرج" : "Graduation Year"} value={dash(data.graduation_year)} />
                        <InfoRow icon={Award} label={ar ? "المعدل" : "GPA"} value={dash(data.gpa)} />
                      </div>
                    </ProfileCard>
                  )}

                  <ProfileCard icon={Briefcase} title={ar ? "الخبرة العملية" : "Work Experience"}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                      <InfoRow icon={Briefcase} label={ar ? "الوظيفة المطلوبة" : "Desired Position"} value={dash(data.desired_position)} />
                      <InfoRow icon={Briefcase} label={ar ? "نوع الوظيفة" : "Job Type"} value={dash(data.job_type)} />
                      <InfoRow icon={Briefcase} label={ar ? "موظف حالياً" : "Currently Employed"} value={dash(data.currently_employed)} />
                      <InfoRow icon={Briefcase} label={ar ? "المسمى الحالي" : "Current Title"} value={dash(data.current_title)} />
                      <InfoRow icon={Briefcase} label={ar ? "سنوات الخبرة" : "Years of Experience"} value={dash(data.years_experience)} />
                      <InfoRow icon={Wallet} label={ar ? "الراتب الحالي" : "Current Salary"} value={dash(data.current_salary)} />
                      <InfoRow icon={Wallet} label={ar ? "الراتب المتوقع" : "Expected Salary"} value={dash(data.expected_salary)} />
                      <InfoRow icon={Calendar} label={ar ? "تاريخ التوفر" : "Available From"} value={dash(data.available_date)} />
                      <InfoRow icon={Briefcase} label={ar ? "خبرة إدارة المرافق" : "Facility Mgmt. Experience"} value={dash(data.facility_management_exp)} />
                    </div>
                    {dash(data.current_tasks) && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">{ar ? "المهام الحالية" : "Current Tasks"}</p>
                        <p className="text-sm whitespace-pre-wrap">{data.current_tasks}</p>
                      </div>
                    )}
                    {dash(data.other_experience) && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">{ar ? "خبرات أخرى" : "Other Experience"}</p>
                        <p className="text-sm whitespace-pre-wrap">{data.other_experience}</p>
                      </div>
                    )}
                  </ProfileCard>

                  {similarCandidates && similarCandidates.length > 0 && (
                    <ProfileCard
                      icon={Users}
                      title={ar ? "مرشحون مشابهون" : "Similar Candidates"}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {similarCandidates.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            disabled={!onSelectApplicant}
                            onClick={() => onSelectApplicant?.(c.id)}
                            className="flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-start text-sm hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
                          >
                            <span className="font-medium truncate w-full">{c.full_name}</span>
                            <span className="text-xs text-muted-foreground truncate w-full">
                              {[c.current_city, c.years_experience].filter(Boolean).join(" · ") || (ar ? "—" : "—")}
                            </span>
                          </button>
                        ))}
                      </div>
                    </ProfileCard>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
