import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
  useApplicantResumeExtractionQuery,
  useApplyExtractedFieldMutation,
  useRunResumeExtractionMutation,
} from "@/hooks/queries/useResumeExtraction";

interface ApplicantResumeExtractionPanelProps {
  lang: "ar" | "en";
  applicantId: string;
  // The admin applicant row already loaded by the host dialog -- read
  // generically since it's used the same way elsewhere in this dialog
  // (e.g. `(selectedApplicant as any).facility_management_exp`).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applicant: Record<string, any>;
}

const FIELD_LABELS: { key: string; ar: string; en: string }[] = [
  { key: "gender", ar: "الجنس", en: "Gender" },
  { key: "nationality", ar: "الجنسية", en: "Nationality" },
  { key: "birth_date", ar: "تاريخ الميلاد", en: "Birth Date" },
  { key: "marital_status", ar: "الحالة الاجتماعية", en: "Marital Status" },
  { key: "current_city", ar: "المدينة الحالية", en: "Current City" },
  { key: "preferred_city", ar: "المدينة المفضلة", en: "Preferred City" },
  { key: "has_transport", ar: "وسيلة نقل", en: "Transportation" },
  { key: "linkedin", ar: "لينكدإن", en: "LinkedIn" },
  { key: "education_level", ar: "المؤهل العلمي", en: "Education Level" },
  { key: "major", ar: "التخصص", en: "Major" },
  { key: "university", ar: "الجامعة", en: "University" },
  { key: "graduation_year", ar: "سنة التخرج", en: "Graduation Year" },
  { key: "gpa", ar: "المعدل", en: "GPA" },
  { key: "desired_position", ar: "الوظيفة المطلوبة", en: "Desired Position" },
  { key: "job_type", ar: "نوع الوظيفة", en: "Job Type" },
  { key: "years_experience", ar: "سنوات الخبرة", en: "Years Experience" },
  { key: "currently_employed", ar: "موظف حالياً", en: "Currently Employed" },
  { key: "current_title", ar: "المسمى الحالي", en: "Current Title" },
  { key: "current_salary", ar: "الراتب الحالي", en: "Current Salary" },
  { key: "expected_salary", ar: "الراتب المتوقع", en: "Expected Salary" },
  { key: "available_date", ar: "تاريخ التوفر", en: "Available Date" },
  { key: "current_tasks", ar: "المهام الحالية", en: "Current Tasks" },
  { key: "other_experience", ar: "خبرات أخرى", en: "Other Experience" },
  { key: "facility_management_exp", ar: "خبرة إدارة المرافق", en: "Facility Mgmt. Exp." },
  { key: "arabic_level", ar: "اللغة العربية", en: "Arabic Level" },
  { key: "english_level", ar: "اللغة الإنجليزية", en: "English Level" },
  { key: "other_language", ar: "لغة أخرى", en: "Other Language" },
  { key: "self_summary", ar: "نبذة مختصرة", en: "Summary" },
];

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

/**
 * Per-candidate view of what extract-applicant-resume-data found in the
 * résumé vs. what's actually saved on the applicant -- lets an admin (a)
 * see the two side by side, and (b) manually apply an extracted value even
 * when it was NOT auto-applied (auto-fill only ever touches blank fields).
 * Also the manual trigger for the ~102k-candidate backlog that predates
 * this feature and never ran automatically.
 */
export default function ApplicantResumeExtractionPanel({ lang, applicantId, applicant }: ApplicantResumeExtractionPanelProps) {
  const ar = lang === "ar";
  const { data, isLoading } = useApplicantResumeExtractionQuery(applicantId);
  const runMutation = useRunResumeExtractionMutation(lang);
  const applyMutation = useApplyExtractedFieldMutation(lang);

  const extractedEntries = data
    ? FIELD_LABELS.filter((f) => !isBlank(data.extracted_data?.[f.key]))
    : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          {ar ? "بيانات مستخرجة من السيرة الذاتية (AI)" : "AI Résumé Extraction"}
        </label>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={runMutation.isPending}
          onClick={() => runMutation.mutate(applicantId)}
        >
          {runMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {data ? (ar ? "إعادة الاستخراج" : "Re-extract") : (ar ? "تشغيل الاستخراج" : "Run extraction")}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : !data ? (
        <p className="text-xs text-muted-foreground">
          {ar ? "لم يتم تشغيل الاستخراج لهذا المرشح بعد." : "Extraction hasn't run for this candidate yet."}
        </p>
      ) : data.status === "error" ? (
        <p className="text-xs text-destructive">{data.error_message || (ar ? "فشل الاستخراج" : "Extraction failed")}</p>
      ) : extractedEntries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {ar ? "لم يُستخرج أي بيانات إضافية من الملف." : "No additional data was extracted from the file."}
        </p>
      ) : (
        <div className="rounded-lg border text-sm overflow-hidden">
          <div className="grid grid-cols-[110px_1fr_1fr_70px] gap-2 px-2 py-1.5 bg-muted/50 text-[11px] text-muted-foreground font-medium">
            <span>{ar ? "الحقل" : "Field"}</span>
            <span>{ar ? "القيمة الحالية" : "Current value"}</span>
            <span>{ar ? "من السيرة الذاتية" : "From résumé"}</span>
            <span />
          </div>
          <div className="divide-y">
            {extractedEntries.map((f) => {
              const extractedVal = String(data.extracted_data[f.key]).trim();
              const currentVal = applicant[f.key];
              const matches = !isBlank(currentVal) && String(currentVal).trim() === extractedVal;
              const wasApplied = data.applied_fields.includes(f.key);
              return (
                <div key={f.key} className="grid grid-cols-[110px_1fr_1fr_70px] gap-2 px-2 py-1.5 items-center">
                  <span className="text-xs text-muted-foreground truncate">{ar ? f.ar : f.en}</span>
                  <span className="text-xs truncate">{isBlank(currentVal) ? <span className="text-muted-foreground">—</span> : String(currentVal)}</span>
                  <span className="text-xs font-medium truncate">{extractedVal}</span>
                  {matches ? (
                    wasApplied && (
                      <Badge variant="outline" className="text-[10px] w-fit border-emerald-600/40 text-emerald-600">
                        {ar ? "مُطبّق" : "Applied"}
                      </Badge>
                    )
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px] w-fit"
                      disabled={applyMutation.isPending}
                      onClick={() =>
                        applyMutation.mutate({
                          applicantId, field: f.key, value: extractedVal, currentAppliedFields: data.applied_fields,
                        })
                      }
                    >
                      {ar ? "تطبيق" : "Apply"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
