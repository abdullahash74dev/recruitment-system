import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Database, FileSpreadsheet, FileJson } from "lucide-react";
import * as XLSX from "xlsx";

const BackupSettings = () => {
  const { lang, t } = useLanguage();
  const [exporting, setExporting] = useState(false);

  const exportAllData = async (format: "xlsx" | "json") => {
    setExporting(true);
    try {
      // Fetch all tables
      const [applicantsRes, jobsRes, customQRes, customARes, projectsRes, profilesRes] = await Promise.all([
        supabase.from("applicants").select("*").order("created_at", { ascending: false }),
        supabase.from("job_postings").select("*").order("created_at", { ascending: false }),
        supabase.from("custom_questions").select("*"),
        supabase.from("custom_answers").select("*"),
        supabase.from("projects").select("*"),
        supabase.from("profiles").select("*"),
      ]);

      const dateStr = new Date().toISOString().split("T")[0];

      if (format === "json") {
        const backup = {
          exported_at: new Date().toISOString(),
          applicants: applicantsRes.data || [],
          job_postings: jobsRes.data || [],
          custom_questions: customQRes.data || [],
          custom_answers: customARes.data || [],
          projects: projectsRes.data || [],
          profiles: profilesRes.data || [],
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

        addSheet(applicantsRes.data || [], lang === "ar" ? "المتقدمين" : "Applicants");
        addSheet(jobsRes.data || [], lang === "ar" ? "الوظائف" : "Jobs");
        addSheet(customQRes.data || [], lang === "ar" ? "الأسئلة" : "Questions");
        addSheet(customARes.data || [], lang === "ar" ? "الإجابات" : "Answers");
        addSheet(projectsRes.data || [], lang === "ar" ? "المشاريع" : "Projects");
        addSheet(profilesRes.data || [], lang === "ar" ? "المستخدمين" : "Users");

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
              ? "للحصول على نسخ احتياطية تلقائية للكود والملفات، اربط المشروع بـ GitHub من إعدادات Lovable."
              : "For automatic code backups, connect your project to GitHub from Lovable settings."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupSettings;
