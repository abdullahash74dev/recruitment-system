import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Download, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";
import { useScheduledReportRunsQuery, useRunScheduledReportMutation } from "@/hooks/queries/useScheduledReports";

const ScheduledReports = () => {
  const { lang } = useLanguage();
  const { data: runs = [] } = useScheduledReportRunsQuery();
  const runMutation = useRunScheduledReportMutation();
  const running = runMutation.isPending;

  const runNow = async () => {
    runMutation.mutate(undefined, {
      onSuccess: (data: any) => {
        toast.success(lang === "ar" ? "تم توليد التقرير" : "Report generated");
        if (data?.file_url) window.open(data.file_url, "_blank");
      },
      onError: (e: any) => {
        toast.error(e.message || (lang === "ar" ? "فشل توليد التقرير" : "Failed"));
      },
    });
  };

  const locale = lang === "ar" ? arLocale : enUS;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="w-4 h-4" />
            {lang === "ar" ? "تقارير التوظيف" : "Recruitment Reports"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {lang === "ar"
              ? "ولّد تقرير Excel شامل: ملخص، مشاريع، أسباب الرفض، قائمة المرشحين"
              : "Generate a comprehensive Excel report: summary, projects, rejection reasons, candidates"}
          </p>
        </div>
        <Button onClick={runNow} disabled={running} className="gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {lang === "ar" ? "توليد الآن" : "Run now"}
        </Button>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {lang === "ar" ? "لم يتم توليد تقارير بعد" : "No reports generated yet"}
          </div>
        ) : (
          <ul className="divide-y">
            {runs.map(r => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.file_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.run_at), { addSuffix: true, locale })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === "success" ? "secondary" : "destructive"}>{r.status}</Badge>
                  {r.file_url && (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(r.file_url!, "_blank")}>
                      <Download className="w-3.5 h-3.5" />
                      {lang === "ar" ? "تنزيل" : "Download"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default ScheduledReports;
