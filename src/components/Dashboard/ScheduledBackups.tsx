import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Download, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";

interface BackupRun {
  id: string;
  status: string;
  file_path: string | null;
  file_size: number | null;
  triggered_by: string;
  error_message: string | null;
  created_at: string;
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ScheduledBackups = () => {
  const { lang } = useLanguage();
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [running, setRunning] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("backup_runs").select("*").order("created_at", { ascending: false }).limit(10);
    setRuns((data as BackupRun[]) || []);
  };

  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scheduled-backup", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(lang === "ar" ? "تم إنشاء نسخة احتياطية" : "Backup created");
      load();
    } catch (e: any) {
      toast.error(e.message || (lang === "ar" ? "فشل إنشاء النسخة الاحتياطية" : "Backup failed"));
    } finally {
      setRunning(false);
    }
  };

  const download = async (run: BackupRun) => {
    if (!run.file_path) return;
    setDownloadingId(run.id);
    try {
      const { data, error } = await supabase.storage.from("backups").createSignedUrl(run.file_path, 60);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch (e: any) {
      toast.error(e.message || (lang === "ar" ? "فشل التحميل" : "Download failed"));
    } finally {
      setDownloadingId(null);
    }
  };

  const locale = lang === "ar" ? arLocale : enUS;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="w-4 h-4" />
            {lang === "ar" ? "النسخ الاحتياطي التلقائي" : "Automatic Backups"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {lang === "ar"
              ? "يتم أخذ نسخة احتياطية كاملة من بيانات النظام تلقائياً كل ليلة، ويُحتفظ بها لمدة 30 يوماً."
              : "A full snapshot of system data is taken automatically every night and kept for 30 days."}
          </p>
        </div>
        <Button onClick={runNow} disabled={running} className="gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {lang === "ar" ? "تشغيل الآن" : "Run now"}
        </Button>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {lang === "ar" ? "لم يتم إنشاء نسخ احتياطية بعد" : "No backups yet"}
          </div>
        ) : (
          <ul className="divide-y">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3 gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {r.file_path ? r.file_path.split("/").pop() : (r.error_message || "—")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale })}
                    {" • "}
                    {r.triggered_by === "cron" ? (lang === "ar" ? "تلقائي" : "automatic") : (lang === "ar" ? "يدوي" : "manual")}
                    {r.status === "success" && ` • ${formatSize(r.file_size)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={r.status === "success" ? "secondary" : "destructive"}>{r.status}</Badge>
                  {r.status === "success" && r.file_path && (
                    <Button variant="outline" size="sm" className="gap-1" disabled={downloadingId === r.id} onClick={() => download(r)}>
                      {downloadingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
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

export default ScheduledBackups;
