import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { FileScan } from "lucide-react";
import {
  useResumeExtractionSettingsQuery,
  useUpdateResumeExtractionSettingMutation,
} from "@/hooks/queries/useResumeExtraction";

/**
 * Global on/off switch for the automatic AI résumé-data extraction that
 * runs right after every new application's résumé upload (fills blank
 * applicant fields from what the résumé itself says -- never overwrites
 * anything the applicant typed in the form). Per-candidate results are
 * reviewable/overridable from each applicant's detail dialog.
 */
export default function ResumeExtractionSettings() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const { data, isLoading } = useResumeExtractionSettingsQuery();
  const updateMutation = useUpdateResumeExtractionSettingMutation();
  const enabled = data?.enabled ?? true;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileScan className="w-4 h-4" />
          {isAr ? "استخراج البيانات من السيرة الذاتية" : "Résumé Data Extraction"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "عند كل تقديم طلب جديد، يقرأ النظام ملف السيرة الذاتية المرفوع ويستخرج منه البيانات تلقائياً (تعليم، خبرة، لغات...) ويملأ بها فقط الحقول التي تركها المتقدم فارغة -- لا يلمس أي حقل عبّأه المتقدم بنفسه."
            : "On every new application, the system reads the uploaded résumé and automatically extracts data (education, experience, languages...) to fill in only the fields the applicant left blank -- it never touches anything the applicant filled in themselves."}
        </p>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">{isAr ? "تفعيل الاستخراج التلقائي" : "Enable automatic extraction"}</p>
            <p className="text-xs text-muted-foreground">
              {isAr ? "يمكنك إيقافه مؤقتاً للتحكم بتكلفة الذكاء الاصطناعي" : "Turn it off temporarily to control AI cost"}
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={isLoading || updateMutation.isPending}
            onCheckedChange={(v) => updateMutation.mutate(v)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {isAr
            ? "لمرشح فردي: افتح ملفه من قائمة المتقدمين وستجد قسم \"بيانات مستخرجة من السيرة الذاتية (AI)\" لمراجعتها أو تشغيل الاستخراج يدوياً (مفيد للمرشحين القدامى الذين قُدّموا قبل تفعيل هذه الميزة)."
            : "For an individual candidate: open their profile from the applicants list -- you'll find an \"AI Résumé Extraction\" section to review results or run extraction manually (useful for older applicants submitted before this feature existed)."}
        </p>
      </CardContent>
    </Card>
  );
}
