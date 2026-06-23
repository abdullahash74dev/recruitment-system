import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Database, Download, Play, Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";
import { useDeletePin } from "@/components/DeletePinDialog";

interface BucketSummary {
  count: number;
  failed: number;
}

interface BackupRun {
  id: string;
  status: string;
  file_path: string | null;
  file_size: number | null;
  backup_folder: string | null;
  tables_summary: Record<string, number> | null;
  buckets_summary: Record<string, BucketSummary> | null;
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

const totalFiles = (buckets: Record<string, BucketSummary> | null) =>
  buckets ? Object.values(buckets).reduce((sum, b) => sum + b.count, 0) : 0;

const ScheduledBackups = () => {
  const { lang } = useLanguage();
  const { requestDelete } = useDeletePin();
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [running, setRunning] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [restoreTarget, setRestoreTarget] = useState<BackupRun | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [includeFiles, setIncludeFiles] = useState(true);
  const [restoring, setRestoring] = useState(false);

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

  const openRestore = (run: BackupRun) => {
    setRestoreTarget(run);
    setRestoreMode("merge");
    setIncludeFiles(true);
  };

  const doRestore = async () => {
    if (!restoreTarget?.backup_folder) return;
    setRestoring(true);
    try {
      const { data, error } = await supabase.functions.invoke("restore-backup", {
        body: { backup_folder: restoreTarget.backup_folder, mode: restoreMode, includeFiles, confirm: "RESTORE" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(lang === "ar" ? "تم استرداد البيانات بنجاح" : "Data restored successfully");
      setRestoreTarget(null);
      load();
    } catch (e: any) {
      toast.error(e.message || (lang === "ar" ? "فشل الاسترداد" : "Restore failed"));
    } finally {
      setRestoring(false);
    }
  };

  const confirmRestore = () => {
    if (restoreMode === "replace") {
      requestDelete({
        message: lang === "ar"
          ? "سيتم استبدال كل البيانات الحالية بمحتوى هذه النسخة الاحتياطية بالضبط، ولن يبقى أي تعديل جرى بعد تاريخها. سيُؤخذ تلقائياً نسخة احتياطية فورية من الوضع الحالي قبل البدء يمكن الاسترجاع منها إن احتجت التراجع."
          : "All current data will be replaced with exactly what's in this backup; anything changed since then will be gone. A safety backup of the current state is taken automatically first, so you can undo this if needed.",
        onConfirm: doRestore,
      });
    } else {
      doRestore();
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
              ? "يتم أخذ نسخة احتياطية كاملة من كل جداول النظام وكل الملفات (السير الذاتية والمرفقات) تلقائياً كل ليلة، ويُحتفظ بها لمدة 30 يوماً."
              : "A full snapshot of every table and every file (resumes, attachments) is taken automatically every night and kept for 30 days."}
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
                    {r.backup_folder || r.file_path ? new Date(r.created_at).toLocaleString(lang === "ar" ? "ar" : "en") : (r.error_message || "—")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale })}
                    {" • "}
                    {r.triggered_by === "cron" ? (lang === "ar" ? "تلقائي" : "automatic") : (lang === "ar" ? "يدوي" : "manual")}
                    {r.status !== "failed" && ` • ${formatSize(r.file_size)}`}
                    {r.status !== "failed" && r.tables_summary && ` • ${Object.keys(r.tables_summary).length} ${lang === "ar" ? "جدول" : "tables"}`}
                    {r.status !== "failed" && r.buckets_summary && ` • ${totalFiles(r.buckets_summary)} ${lang === "ar" ? "ملف" : "files"}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === "success" ? (
                    <Badge variant="secondary">{r.status}</Badge>
                  ) : r.status === "warning" ? (
                    <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400 gap-1">
                      <AlertTriangle className="w-3 h-3" />{r.status}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">{r.status}</Badge>
                  )}
                  {r.status !== "failed" && r.file_path && (
                    <Button variant="outline" size="sm" className="gap-1" disabled={downloadingId === r.id} onClick={() => download(r)}>
                      {downloadingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      {lang === "ar" ? "تنزيل" : "Download"}
                    </Button>
                  )}
                  {r.status !== "failed" && r.backup_folder && (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => openRestore(r)}>
                      <RotateCcw className="w-3.5 h-3.5" />
                      {lang === "ar" ? "استرداد" : "Restore"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={!!restoreTarget} onOpenChange={(o) => !o && !restoring && setRestoreTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "استرداد من نسخة احتياطية" : "Restore from backup"}</DialogTitle>
            <DialogDescription>
              {restoreTarget && (lang === "ar"
                ? `النسخة بتاريخ ${new Date(restoreTarget.created_at).toLocaleString("ar")} • ${restoreTarget.tables_summary ? Object.keys(restoreTarget.tables_summary).length : 0} جدول • ${totalFiles(restoreTarget.buckets_summary)} ملف`
                : `Backup from ${new Date(restoreTarget.created_at).toLocaleString("en")} • ${restoreTarget.tables_summary ? Object.keys(restoreTarget.tables_summary).length : 0} tables • ${totalFiles(restoreTarget.buckets_summary)} files`)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{lang === "ar" ? "طريقة الاسترداد" : "Restore mode"}</Label>
              <RadioGroup value={restoreMode} onValueChange={(v) => setRestoreMode(v as "merge" | "replace")}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="merge" id="mode-merge" className="mt-1" />
                  <Label htmlFor="mode-merge" className="font-normal cursor-pointer">
                    <div className="font-medium">{lang === "ar" ? "دمج آمن" : "Safe merge"}</div>
                    <div className="text-xs text-muted-foreground">
                      {lang === "ar"
                        ? "يضيف/يحدّث من النسخة الاحتياطية فقط، لا يحذف أي بيانات حالية ليست في النسخة."
                        : "Adds/updates from the backup only — never deletes a current row that isn't in the backup."}
                    </div>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="replace" id="mode-replace" className="mt-1" />
                  <Label htmlFor="mode-replace" className="font-normal cursor-pointer">
                    <div className="font-medium text-destructive">{lang === "ar" ? "استبدال كامل" : "Full replace"}</div>
                    <div className="text-xs text-muted-foreground">
                      {lang === "ar"
                        ? "يعيد كل شيء طبق الأصل لحالة النسخة الاحتياطية بالضبط، ويحذف كل ما أُضيف بعدها."
                        : "Restores everything to exactly match the backup, deleting anything added since."}
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="include-files" checked={includeFiles} onCheckedChange={(c) => setIncludeFiles(!!c)} />
              <Label htmlFor="include-files" className="font-normal cursor-pointer">
                {lang === "ar" ? "استرداد الملفات أيضاً (السير الذاتية والمرفقات)" : "Also restore files (resumes, attachments)"}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreTarget(null)} disabled={restoring}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant={restoreMode === "replace" ? "destructive" : "default"} onClick={confirmRestore} disabled={restoring} className="gap-2">
              {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              {lang === "ar" ? "بدء الاسترداد" : "Start restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ScheduledBackups;
