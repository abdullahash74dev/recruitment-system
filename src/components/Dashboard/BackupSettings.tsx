import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Database, FileSpreadsheet, FileJson } from "lucide-react";
import * as XLSX from "xlsx";

type BackupTable = "applicants" | "job_postings" | "custom_questions" | "custom_answers" | "projects" | "profiles";

// Paginated fetch: a flat .select("*") is silently capped at the platform's
// default row limit, which would make a backup report "success" while only
// capturing a fraction of large tables like applicants.
const fetchAllRows = async (table: BackupTable, orderBy?: string) => {
  const PAGE_SIZE = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let q = supabase.from(table).select("*");
    if (orderBy) q = q.order(orderBy, { ascending: false });
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
};

const BackupSettings = () => {
  const { lang, t } = useLanguage();
  const [exporting, setExporting] = useState(false);

  const exportAllData = async (format: "xlsx" | "json") => {
    setExporting(true);
    try {
      // Fetch all tables (fully, via pagination)
      const [applicants, jobPostings, customQuestions, customAnswers, projects, profiles] = await Promise.all([
        fetchAllRows("applicants", "created_at"),
        fetchAllRows("job_postings", "created_at"),
        fetchAllRows("custom_questions"),
        fetchAllRows("custom_answers"),
        fetchAllRows("projects"),
        fetchAllRows("profiles"),
      ]);

      const dateStr = new Date().toISOString().split("T")[0];

      if (format === "json") {
        const backup = {
          exported_at: new Date().toISOString(),
          applicants,
          job_postings: jobPostings,
          custom_questions: customQuestions,
          custom_answers: customAnswers,
          projects,
          profiles,
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `backup_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const wb = XLSX.utils.book_new();

        const addSheet = (data: any[], name: string) => {
          if (data.length > 0) {
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
          }
        };

        addSheet(applicants, lang === "ar" ? "المتقدمين" : "Applicants");
        addSheet(jobPostings, lang === "ar" ? "الوظائف" : "Jobs");
        addSheet(customQuestions, lang === "ar" ? "الأسئلة" : "Questions");
        addSheet(customAnswers, lang === "ar" ? "الإجابات" : "Answers");
        addSheet(projects, lang === "ar" ? "المشاريع" : "Projects");
        addSheet(profiles, lang === "ar" ? "المستخدمين" : "Users");

        XLSX.writeFile(wb, `backup_${dateStr}.xlsx`);
      }

      toast.success(lang === "ar" ? "تم تصدير النسخة الاحتياطية بنجاح" : "Backup exported successfully");
    } catch (error) {
      toast.error(lang === "ar" ? "خطأ في التصدير" : "Export error");
    }
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="w-5 h-5" />
        <h3 className="text-lg font-bold">{lang === "ar" ? "النسخ الاحتياطي" : "Data Backup"}</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        {lang === "ar"
          ? "قم بتصدير جميع بيانات النظام كنسخة احتياطية. يشمل التصدير: المتقدمين، الوظائف، الأسئلة المخصصة، المشاريع، والمستخدمين."
          : "Export all system data as a backup. Includes: applicants, jobs, custom questions, projects, and users."}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center space-y-4">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-green-600" />
            <div>
              <h4 className="font-bold">{lang === "ar" ? "تصدير Excel" : "Export Excel"}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "ar" ? "ملف Excel يحتوي على كل جدول في ورقة منفصلة" : "Excel file with each table in a separate sheet"}
              </p>
            </div>
            <Button
              onClick={() => exportAllData("xlsx")}
              disabled={exporting}
              className="w-full gap-2"
              variant="outline"
            >
              <Download className="w-4 h-4" />
              {exporting ? "..." : (lang === "ar" ? "تحميل XLSX" : "Download XLSX")}
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 text-center space-y-4">
            <FileJson className="w-12 h-12 mx-auto text-blue-600" />
            <div>
              <h4 className="font-bold">{lang === "ar" ? "تصدير JSON" : "Export JSON"}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "ar" ? "ملف JSON يحتوي على جميع البيانات الخام" : "JSON file with all raw data"}
              </p>
            </div>
            <Button
              onClick={() => exportAllData("json")}
              disabled={exporting}
              className="w-full gap-2"
              variant="outline"
            >
              <Download className="w-4 h-4" />
              {exporting ? "..." : (lang === "ar" ? "تحميل JSON" : "Download JSON")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-sm">
            <strong>{lang === "ar" ? "💡 ملاحظة:" : "💡 Note:"}</strong>{" "}
            {lang === "ar"
              ? "يتم نسخ الكود والملفات احتياطياً تلقائياً عبر مستودع GitHub الخاص بالمشروع."
              : "Your code and files are automatically backed up via the project's GitHub repository."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupSettings;
