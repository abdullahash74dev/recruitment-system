import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useClientApplicantProfileQuery, type ClientApplicantProfile } from "@/hooks/queries/useClientPortalSearch";

interface ClientCompareDialogProps {
  lang: "ar" | "en";
  applicantIds: string[];
  onClose: () => void;
}

const dash = (v: string | null | undefined) => (v && String(v).trim() ? v : "—");

interface CompareRowDef {
  key: keyof ClientApplicantProfile;
  ar: string;
  en: string;
}

const COMPARE_ROWS: CompareRowDef[] = [
  { key: "desired_position", ar: "الوظيفة المطلوبة", en: "Desired Position" },
  { key: "nationality", ar: "الجنسية", en: "Nationality" },
  { key: "gender", ar: "الجنس", en: "Gender" },
  { key: "current_city", ar: "المدينة الحالية", en: "Current City" },
  { key: "education_level", ar: "المؤهل العلمي", en: "Education" },
  { key: "major", ar: "التخصص", en: "Major" },
  { key: "university", ar: "الجامعة", en: "University" },
  { key: "gpa", ar: "المعدل", en: "GPA" },
  { key: "years_experience", ar: "سنوات الخبرة", en: "Years of Experience" },
  { key: "current_title", ar: "المسمى الحالي", en: "Current Title" },
  { key: "currently_employed", ar: "موظف حالياً", en: "Currently Employed" },
  { key: "expected_salary", ar: "الراتب المتوقع", en: "Expected Salary" },
  { key: "available_date", ar: "تاريخ التوفر", en: "Available From" },
  { key: "arabic_level", ar: "اللغة العربية", en: "Arabic Level" },
  { key: "english_level", ar: "اللغة الإنجليزية", en: "English Level" },
  { key: "has_transport", ar: "وسيلة نقل", en: "Transportation" },
];

/**
 * Side-by-side comparison of 2-3 candidates -- reuses
 * useClientApplicantProfileQuery (same masking/reveal-gating as the single
 * profile dialog) called a fixed 3 times (hooks can't run in a
 * variable-length loop), with unused slots passed `null` so the query
 * short-circuits via `enabled`.
 */
export default function ClientCompareDialog({ lang, applicantIds, onClose }: ClientCompareDialogProps) {
  const ar = lang === "ar";
  const open = applicantIds.length > 0;

  const p1 = useClientApplicantProfileQuery(applicantIds[0] ?? null, lang);
  const p2 = useClientApplicantProfileQuery(applicantIds[1] ?? null, lang);
  const p3 = useClientApplicantProfileQuery(applicantIds[2] ?? null, lang);
  const profiles = [p1, p2, p3].slice(0, applicantIds.length);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{ar ? "مقارنة المرشحين" : "Compare Candidates"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh]">
          <div dir={ar ? "rtl" : "ltr"} className="min-w-[560px]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-start p-2 w-32 shrink-0" />
                  {profiles.map((p, i) => (
                    <th key={applicantIds[i]} className="text-start p-2 align-top border-s">
                      {p.isLoading || !p.data ? (
                        <Skeleton className="h-5 w-24" />
                      ) : (
                        <div>
                          <div className="font-semibold">{p.data.full_name}</div>
                          {p.data.is_revealed ? (
                            <Badge variant="outline" className="border-emerald-600/40 text-emerald-600 text-[10px] mt-1">
                              {ar ? "مكشوف" : "Revealed"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] mt-1">
                              {ar ? "غير مكشوف" : "Not revealed"}
                            </Badge>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="p-2 text-xs text-muted-foreground font-medium">{ar ? "الهاتف" : "Phone"}</td>
                  {profiles.map((p, i) => (
                    <td key={applicantIds[i]} className="p-2 border-s" dir="ltr">
                      {p.data ? dash(p.data.phone) : <Skeleton className="h-4 w-20" />}
                    </td>
                  ))}
                </tr>
                <tr className="border-t bg-muted/30">
                  <td className="p-2 text-xs text-muted-foreground font-medium">{ar ? "الإيميل" : "Email"}</td>
                  {profiles.map((p, i) => (
                    <td key={applicantIds[i]} className="p-2 border-s" dir="ltr">
                      {p.data ? dash(p.data.email) : <Skeleton className="h-4 w-20" />}
                    </td>
                  ))}
                </tr>
                {COMPARE_ROWS.map((row, idx) => (
                  <tr key={row.key} className={`border-t ${idx % 2 === 1 ? "bg-muted/30" : ""}`}>
                    <td className="p-2 text-xs text-muted-foreground font-medium">{ar ? row.ar : row.en}</td>
                    {profiles.map((p, i) => (
                      <td key={applicantIds[i]} className="p-2 border-s">
                        {p.data ? dash(p.data[row.key] as string | null) : <Skeleton className="h-4 w-20" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
