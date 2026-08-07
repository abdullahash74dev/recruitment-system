import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Award, Briefcase, Calendar, Car, FileText, GraduationCap, Languages as LanguagesIcon,
  Linkedin, Mail, MapPin, Phone, User, Wallet,
} from "lucide-react";
import { useClientApplicantProfileQuery, type ClientApplicantProfile } from "@/hooks/queries/useClientPortalSearch";

interface ClientApplicantProfileDialogProps {
  lang: "ar" | "en";
  applicantId: string | null;
  onClose: () => void;
}

const dash = (v: string | null | undefined) => (v && String(v).trim() ? v : null);

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
}

/** One label/value row, only rendered when the value is present -- the profile
 * is built entirely from optional fields, so every row/section here quietly
 * disappears rather than showing an empty dash, keeping the vertical layout
 * dense and CV-like instead of a grid full of placeholders. */
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-primary mb-1">{children}</h3>;
}

/**
 * Client-facing full applicant profile -- a structured, always-legible
 * vertical CV-style view built from the same DB columns instead of handing
 * out the candidate's raw uploaded résumé PDF. Deliberately does NOT offer
 * the résumé file itself (résumé download was removed from the client
 * portal in favor of this page); the other supporting documents (degree,
 * experience/training certs) are still offered as-is since they're
 * verification attachments a hiring org legitimately needs, not the primary
 * "CV" surface. This is also the natural landing spot for AI-extracted
 * résumé fields later, without any layout rework.
 */
export default function ClientApplicantProfileDialog({ lang, applicantId, onClose }: ClientApplicantProfileDialogProps) {
  const ar = lang === "ar";
  const { data, isLoading } = useClientApplicantProfileQuery(applicantId, lang);

  return (
    <Dialog open={!!applicantId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[85vh] overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{ar ? "الملف الكامل للمرشح" : "Candidate full profile"}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : (
          <ScrollArea className="max-h-[85vh]">
            <div dir={ar ? "rtl" : "ltr"} className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-semibold">
                  {initials(data.full_name)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold truncate">{data.full_name}</h2>
                  {dash(data.desired_position) && (
                    <p className="text-sm text-muted-foreground truncate">{data.desired_position}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {dash(data.job_type) && <Badge variant="secondary" className="text-[10px]">{data.job_type}</Badge>}
                    {dash(data.currently_employed) && (
                      <Badge variant="outline" className="text-[10px]">{data.currently_employed}</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact -- reachable here only because this dialog only ever
                  opens for an already-revealed candidate. */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <InfoRow icon={Phone} label={ar ? "الهاتف" : "Phone"} value={dash(data.phone)} />
                <InfoRow icon={Mail} label={ar ? "الإيميل" : "Email"} value={dash(data.email)} />
                {dash(data.linkedin) && (
                  <div className="flex items-center gap-2.5 py-1.5">
                    <Linkedin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {data.linkedin!.startsWith("http") ? (
                      <a href={data.linkedin!} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline break-all">
                        {ar ? "الملف الشخصي على لينكدإن" : "LinkedIn profile"}
                      </a>
                    ) : (
                      <span className="text-sm">{data.linkedin}</span>
                    )}
                  </div>
                )}
              </div>

              {dash(data.self_summary) && (
                <div>
                  <SectionTitle>{ar ? "نبذة مختصرة" : "Summary"}</SectionTitle>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{data.self_summary}</p>
                </div>
              )}

              <Separator />

              {/* Personal */}
              <div>
                <SectionTitle>{ar ? "معلومات شخصية" : "Personal Information"}</SectionTitle>
                <InfoRow icon={User} label={ar ? "الجنس" : "Gender"} value={dash(data.gender)} />
                <InfoRow icon={User} label={ar ? "الجنسية" : "Nationality"} value={dash(data.nationality)} />
                <InfoRow icon={Calendar} label={ar ? "تاريخ الميلاد" : "Birth Date"} value={dash(data.birth_date)} />
                <InfoRow icon={User} label={ar ? "الحالة الاجتماعية" : "Marital Status"} value={dash(data.marital_status)} />
                <InfoRow icon={MapPin} label={ar ? "المدينة الحالية" : "Current City"} value={dash(data.current_city)} />
                <InfoRow icon={MapPin} label={ar ? "المدينة المفضلة" : "Preferred City"} value={dash(data.preferred_city)} />
                <InfoRow icon={Car} label={ar ? "وسيلة نقل" : "Transportation"} value={dash(data.has_transport)} />
              </div>

              {(dash(data.education_level) || dash(data.major) || dash(data.university)) && (
                <>
                  <Separator />
                  <div>
                    <SectionTitle>{ar ? "التعليم" : "Education"}</SectionTitle>
                    <InfoRow icon={GraduationCap} label={ar ? "المؤهل العلمي" : "Education Level"} value={dash(data.education_level)} />
                    <InfoRow icon={GraduationCap} label={ar ? "التخصص" : "Major"} value={dash(data.major)} />
                    <InfoRow icon={GraduationCap} label={ar ? "الجامعة" : "University"} value={dash(data.university)} />
                    <InfoRow icon={Calendar} label={ar ? "سنة التخرج" : "Graduation Year"} value={dash(data.graduation_year)} />
                    <InfoRow icon={Award} label={ar ? "المعدل" : "GPA"} value={dash(data.gpa)} />
                  </div>
                </>
              )}

              <Separator />
              <div>
                <SectionTitle>{ar ? "الخبرة العملية" : "Work Experience"}</SectionTitle>
                <InfoRow icon={Briefcase} label={ar ? "المسمى الحالي" : "Current Title"} value={dash(data.current_title)} />
                <InfoRow icon={Briefcase} label={ar ? "سنوات الخبرة" : "Years of Experience"} value={dash(data.years_experience)} />
                <InfoRow icon={Wallet} label={ar ? "الراتب الحالي" : "Current Salary"} value={dash(data.current_salary)} />
                <InfoRow icon={Wallet} label={ar ? "الراتب المتوقع" : "Expected Salary"} value={dash(data.expected_salary)} />
                <InfoRow icon={Calendar} label={ar ? "تاريخ التوفر" : "Available From"} value={dash(data.available_date)} />
                <InfoRow icon={Briefcase} label={ar ? "خبرة إدارة المرافق" : "Facility Management Experience"} value={dash(data.facility_management_exp)} />
                {dash(data.current_tasks) && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1">{ar ? "المهام الحالية" : "Current Tasks"}</p>
                    <p className="text-sm whitespace-pre-wrap">{data.current_tasks}</p>
                  </div>
                )}
                {dash(data.other_experience) && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1">{ar ? "خبرات أخرى" : "Other Experience"}</p>
                    <p className="text-sm whitespace-pre-wrap">{data.other_experience}</p>
                  </div>
                )}
              </div>

              {(dash(data.arabic_level) || dash(data.english_level) || dash(data.other_language)) && (
                <>
                  <Separator />
                  <div>
                    <SectionTitle>{ar ? "اللغات" : "Languages"}</SectionTitle>
                    <InfoRow icon={LanguagesIcon} label={ar ? "العربية" : "Arabic"} value={dash(data.arabic_level)} />
                    <InfoRow icon={LanguagesIcon} label={ar ? "الإنجليزية" : "English"} value={dash(data.english_level)} />
                    <InfoRow icon={LanguagesIcon} label={ar ? "لغة أخرى" : "Other Language"} value={dash(data.other_language)} />
                  </div>
                </>
              )}

              {(dash(data.degree_url) || dash(data.experience_cert_url) || dash(data.training_certs_url) || dash(data.other_docs_url)) && (
                <>
                  <Separator />
                  <div>
                    <SectionTitle>{ar ? "مستندات إضافية" : "Additional Documents"}</SectionTitle>
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
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
