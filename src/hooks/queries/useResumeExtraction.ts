import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

// ---- Global on/off switch (Settings > AI Settings) ----

export interface ResumeExtractionSettings {
  enabled: boolean;
}

async function fetchResumeExtractionSettings(): Promise<ResumeExtractionSettings> {
  const { data } = await (supabase as any)
    .from("resume_extraction_settings")
    .select("enabled")
    .eq("id", true)
    .maybeSingle();
  return { enabled: data?.enabled ?? true };
}

export function useResumeExtractionSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.resumeExtraction.settings(),
    queryFn: fetchResumeExtractionSettings,
  });
}

export function useUpdateResumeExtractionSettingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await (supabase as any)
        .from("resume_extraction_settings")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resumeExtraction.settings() });
    },
  });
}

// ---- Per-applicant extraction result (extracted vs. what was applied) ----

export interface ApplicantResumeExtraction {
  extracted_data: Record<string, string | null>;
  applied_fields: string[];
  model: string | null;
  status: string;
  error_message: string | null;
  extracted_at: string;
}

async function fetchApplicantResumeExtraction(applicantId: string): Promise<ApplicantResumeExtraction | null> {
  const { data } = await (supabase as any)
    .from("applicant_resume_extractions")
    .select("extracted_data, applied_fields, model, status, error_message, extracted_at")
    .eq("applicant_id", applicantId)
    .maybeSingle();
  return (data as ApplicantResumeExtraction) ?? null;
}

export function useApplicantResumeExtractionQuery(applicantId: string | null) {
  return useQuery({
    queryKey: queryKeys.resumeExtraction.forApplicant(applicantId ?? ""),
    queryFn: () => fetchApplicantResumeExtraction(applicantId!),
    enabled: !!applicantId,
  });
}

/**
 * Manually (re-)runs extraction for one applicant -- covers both the
 * ~102k-candidate backlog that predates this feature (never ran
 * automatically) and re-tries after a failed/skipped run. Calls the edge
 * function with the admin's own session JWT (supabase-js attaches it
 * automatically), which the function accepts via its has_role(admin) check.
 */
export function useRunResumeExtractionMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (applicantId: string) => {
      const { data, error } = await supabase.functions.invoke("extract-applicant-resume-data", {
        body: { applicant_id: applicantId },
      });
      if (error) throw error;
      return data as { skipped?: boolean; reason?: string; extracted?: Record<string, string | null>; applied_fields?: string[] };
    },
    onSuccess: (data, applicantId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resumeExtraction.forApplicant(applicantId) });
      if (data.skipped) {
        const reasons: Record<string, { ar: string; en: string }> = {
          no_resume: { ar: "لا يوجد ملف سيرة ذاتية مرفوع لهذا المرشح", en: "This applicant has no résumé file uploaded" },
          unsupported_file_type: { ar: "نوع الملف غير مدعوم للاستخراج (فقط PDF أو صورة)", en: "File type not supported for extraction (PDF or image only)" },
          disabled: { ar: "ميزة الاستخراج التلقائي معطّلة من الإعدادات", en: "Automatic extraction is disabled in Settings" },
        };
        const r = reasons[data.reason || ""] || { ar: "تم التخطي", en: "Skipped" };
        toast.warning(ar ? r.ar : r.en);
      } else {
        const count = data.applied_fields?.length ?? 0;
        toast.success(
          count > 0
            ? ar
              ? `تم استخراج البيانات وتعبئة ${count} حقل فارغ`
              : `Extraction complete -- filled ${count} blank field(s)`
            : ar
            ? "تم الاستخراج، ولا توجد حقول فارغة لتعبئتها"
            : "Extraction complete -- no blank fields to fill"
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || (ar ? "تعذر تشغيل الاستخراج" : "Failed to run extraction"));
    },
  });
}

/**
 * Lets an admin manually apply one extracted field even when it was NOT
 * auto-applied (i.e. the applicant had already filled it in) -- an explicit
 * override action, distinct from the auto-fill-blanks-only default.
 */
export function useApplyExtractedFieldMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async ({
      applicantId, field, value, currentAppliedFields,
    }: { applicantId: string; field: string; value: string; currentAppliedFields: string[] }) => {
      const { error: applicantError } = await (supabase as any)
        .from("applicants")
        .update({ [field]: value })
        .eq("id", applicantId);
      if (applicantError) throw applicantError;

      const nextApplied = currentAppliedFields.includes(field) ? currentAppliedFields : [...currentAppliedFields, field];
      const { error: extractionError } = await (supabase as any)
        .from("applicant_resume_extractions")
        .update({ applied_fields: nextApplied })
        .eq("applicant_id", applicantId);
      if (extractionError) throw extractionError;
    },
    onSuccess: (_data, { applicantId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.resumeExtraction.forApplicant(applicantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.applicants.all, exact: false });
      toast.success(ar ? "تم تطبيق القيمة المستخرجة" : "Extracted value applied");
    },
    onError: (error: Error) => {
      toast.error(error.message || (ar ? "تعذر تطبيق القيمة" : "Failed to apply value"));
    },
  });
}
