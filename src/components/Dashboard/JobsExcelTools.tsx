import { useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileSpreadsheet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDeletePin } from "@/components/DeletePinDialog";

interface Props {
  jobs: any[];
  onChanged: () => void;
}

// Column headers (kept stable for round-trip import/export)
const COLS = [
  "title_ar","title_en",
  "department","department_en",
  "location","location_en",
  "job_type","job_type_en",
  "vacancy_count",
  "salary_range",
  "experience_required_ar","experience_required_en",
  "degree_required_ar","degree_required_en",
  "nationality_required","nationality_required_en",
  "description_ar","description_en",
  "requirements_ar","requirements_en",
  "additional_details_ar","additional_details_en",
  "is_active",
] as const;

const HEADERS_AR: Record<string, string> = {
  title_ar: "المسمى الوظيفي (عربي) *",
  title_en: "المسمى الوظيفي (إنجليزي)",
  department: "القسم (عربي)",
  department_en: "القسم (إنجليزي)",
  location: "الموقع (عربي) *",
  location_en: "الموقع (إنجليزي)",
  job_type: "نوع العمل (عربي) *",
  job_type_en: "نوع العمل (إنجليزي)",
  vacancy_count: "عدد الشواغر",
  salary_range: "الراتب",
  experience_required_ar: "سنوات الخبرة (عربي)",
  experience_required_en: "سنوات الخبرة (إنجليزي)",
  degree_required_ar: "المؤهل المطلوب (عربي)",
  degree_required_en: "المؤهل المطلوب (إنجليزي)",
  nationality_required: "الجنسية المطلوبة (عربي)",
  nationality_required_en: "الجنسية المطلوبة (إنجليزي)",
  description_ar: "الوصف الوظيفي والمهام (عربي)",
  description_en: "الوصف الوظيفي والمهام (إنجليزي)",
  requirements_ar: "المتطلبات (عربي)",
  requirements_en: "المتطلبات (إنجليزي)",
  additional_details_ar: "تفاصيل إضافية (عربي)",
  additional_details_en: "تفاصيل إضافية (إنجليزي)",
  is_active: "مفعّلة (Yes/No)",
};

const SAMPLE_ROW: Record<string, any> = {
  title_ar: "مهندس صيانة",
  title_en: "Maintenance Engineer",
  department: "الصيانة",
  department_en: "Maintenance",
  location: "الرياض",
  location_en: "Riyadh",
  job_type: "دوام كامل",
  job_type_en: "Full-time",
  vacancy_count: 2,
  salary_range: "8000-12000 SAR",
  experience_required_ar: "3-5 سنوات",
  experience_required_en: "3-5 years",
  degree_required_ar: "بكالوريوس هندسة ميكانيكية",
  degree_required_en: "Bachelor in Mechanical Engineering",
  nationality_required: "سعودي",
  nationality_required_en: "Saudi",
  description_ar: "متابعة أعمال الصيانة الوقائية والعلاجية للمعدات.\nإعداد التقارير الدورية.",
  description_en: "Perform preventive and corrective maintenance.\nPrepare periodic reports.",
  requirements_ar: "خبرة في إدارة المرافق.\nإجادة الحاسب.",
  requirements_en: "Facility management experience.\nComputer literacy.",
  additional_details_ar: "العمل ضمن فريق متعدد التخصصات.",
  additional_details_en: "Work within a multidisciplinary team.",
  is_active: "Yes",
};

const buildSheet = (rows: any[], lang: string) => {
  const headerRow: Record<string, string> = {};
  COLS.forEach(c => { headerRow[c] = HEADERS_AR[c]; });

  // First row = friendly Arabic headers (as data), real keys are COLS
  const data = [headerRow, ...rows];
  const ws = XLSX.utils.json_to_sheet(data, { header: COLS as any });
  // Widen columns
  ws["!cols"] = COLS.map(c => ({ wch: c.includes("description") || c.includes("requirements") || c.includes("additional") ? 40 : 20 }));
  return ws;
};

const JobsExcelTools = ({ jobs, onChanged }: Props) => {
  const { lang } = useLanguage();
  const { requestDelete } = useDeletePin();
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const ws = buildSheet([SAMPLE_ROW], lang);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jobs");
    XLSX.writeFile(wb, "jobs_template.xlsx");
    toast.success(lang === "ar" ? "تم تحميل القالب" : "Template downloaded");
  };

  const exportCurrent = () => {
    if (jobs.length === 0) {
      toast.error(lang === "ar" ? "لا توجد وظائف للتصدير" : "No jobs to export");
      return;
    }
    const rows = jobs.map(j => {
      const row: any = {};
      COLS.forEach(c => {
        if (c === "is_active") row[c] = j.is_active ? "Yes" : "No";
        else row[c] = j[c] ?? "";
      });
      return row;
    });
    const ws = buildSheet(rows, lang);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jobs");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `jobs_export_${date}.xlsx`);
    toast.success(lang === "ar" ? `تم تصدير ${jobs.length} وظيفة` : `Exported ${jobs.length} jobs`);
  };

  const triggerImport = () => fileRef.current?.click();

  const doImport = async (rowsToInsert: any[]) => {
    const { error } = await supabase.from("job_postings").insert(rowsToInsert);
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // Skip first row if it's the friendly-header row
      const filtered = raw.filter(r => r.title_ar && r.title_ar !== HEADERS_AR.title_ar);

      if (filtered.length === 0) {
        toast.error(lang === "ar" ? "لا توجد وظائف صالحة في الملف (تأكد من تعبئة المسمى الوظيفي بالعربي)" : "No valid jobs found");
        return;
      }

      const rows = filtered.map(r => ({
        title_ar: String(r.title_ar).trim(),
        title_en: String(r.title_en || "").trim() || null,
        department: String(r.department || "").trim() || null,
        department_en: String(r.department_en || "").trim() || null,
        location: String(r.location || "").trim() || (lang === "ar" ? "غير محدد" : "Unspecified"),
        location_en: String(r.location_en || "").trim() || null,
        job_type: String(r.job_type || "").trim() || (lang === "ar" ? "دوام كامل" : "Full-time"),
        job_type_en: String(r.job_type_en || "").trim() || null,
        vacancy_count: Number(r.vacancy_count) > 0 ? Number(r.vacancy_count) : 1,
        salary_range: String(r.salary_range || "").trim() || null,
        experience_required_ar: String(r.experience_required_ar || "").trim() || null,
        experience_required_en: String(r.experience_required_en || "").trim() || null,
        degree_required_ar: String(r.degree_required_ar || "").trim() || null,
        degree_required_en: String(r.degree_required_en || "").trim() || null,
        nationality_required: String(r.nationality_required || "").trim() || null,
        nationality_required_en: String(r.nationality_required_en || "").trim() || null,
        description_ar: String(r.description_ar || "").trim() || null,
        description_en: String(r.description_en || "").trim() || null,
        requirements_ar: String(r.requirements_ar || "").trim() || null,
        requirements_en: String(r.requirements_en || "").trim() || null,
        additional_details_ar: String(r.additional_details_ar || "").trim() || null,
        additional_details_en: String(r.additional_details_en || "").trim() || null,
        is_active: String(r.is_active || "Yes").toLowerCase() !== "no",
      }));

      // Ask: append or replace
      const replace = window.confirm(
        lang === "ar"
          ? `سيتم استيراد ${rows.length} وظيفة.\n\nاضغط "موافق" لاستبدال جميع الوظائف الحالية (يتطلب رقم سري).\nاضغط "إلغاء" لإضافتها للوظائف الموجودة.`
          : `${rows.length} jobs will be imported.\n\nClick OK to REPLACE all existing jobs (requires PIN).\nClick Cancel to APPEND to existing jobs.`
      );

      if (replace) {
        requestDelete({
          message: lang === "ar"
            ? `سيتم حذف جميع الوظائف الحالية (${jobs.length}) ثم استيراد ${rows.length} وظيفة جديدة.`
            : `All current jobs (${jobs.length}) will be deleted then ${rows.length} new jobs imported.`,
          onConfirm: async () => {
            const { error: delErr } = await supabase.from("job_postings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
            if (delErr) { toast.error(delErr.message); return; }
            const ok = await doImport(rows);
            if (ok) { toast.success(lang === "ar" ? `تم استبدال الوظائف بنجاح (${rows.length})` : `Replaced with ${rows.length} jobs`); onChanged(); }
          },
        });
      } else {
        const ok = await doImport(rows);
        if (ok) { toast.success(lang === "ar" ? `تم استيراد ${rows.length} وظيفة` : `Imported ${rows.length} jobs`); onChanged(); }
      }
    } catch (err: any) {
      toast.error(lang === "ar" ? "خطأ في قراءة الملف: " + err.message : "Error reading file: " + err.message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteAll = () => {
    if (jobs.length === 0) {
      toast.error(lang === "ar" ? "لا توجد وظائف للحذف" : "No jobs to delete");
      return;
    }
    requestDelete({
      message: lang === "ar"
        ? `سيتم حذف جميع الوظائف الشاغرة نهائياً (${jobs.length} وظيفة). لا يمكن التراجع عن هذه العملية.`
        : `All ${jobs.length} job postings will be permanently deleted. This cannot be undone.`,
      onConfirm: async () => {
        const { error } = await supabase.from("job_postings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) { toast.error(error.message); return; }
        toast.success(lang === "ar" ? "تم حذف جميع الوظائف" : "All jobs deleted");
        onChanged();
      },
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-muted/30">
      <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-semibold">{lang === "ar" ? "أدوات Excel:" : "Excel tools:"}</span>
      <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1">
        <Download className="w-3.5 h-3.5" />
        {lang === "ar" ? "تحميل قالب" : "Template"}
      </Button>
      <Button variant="outline" size="sm" onClick={exportCurrent} className="gap-1">
        <Download className="w-3.5 h-3.5" />
        {lang === "ar" ? "تصدير الحالي" : "Export current"}
      </Button>
      <Button variant="outline" size="sm" onClick={triggerImport} className="gap-1">
        <Upload className="w-3.5 h-3.5" />
        {lang === "ar" ? "استيراد من Excel" : "Import from Excel"}
      </Button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
      <div className="flex-1" />
      <Button variant="destructive" size="sm" onClick={deleteAll} className="gap-1" disabled={jobs.length === 0}>
        <Trash2 className="w-3.5 h-3.5" />
        {lang === "ar" ? `حذف الكل (${jobs.length})` : `Delete all (${jobs.length})`}
      </Button>
    </div>
  );
};

export default JobsExcelTools;
