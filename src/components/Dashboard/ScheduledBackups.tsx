import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Database, Download, Play, Loader2, RotateCcw, AlertTriangle,
  ShieldCheck, ShieldAlert, Check, X, Cloud, Webhook, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";
import { useDeletePin } from "@/components/DeletePinDialog";
import {
  BACKUP_SECRET_KEYS as SECRET_KEYS,
  type BackupRun,
  type BucketUsage as BucketSummary,
  type RestoreApproval,
  useBackupRunsQuery,
  useBackupSecretsSettingsQuery,
  useDecideRestoreApprovalMutation,
  useDownloadBackupMutation,
  useRestoreApprovalsQuery,
  useRestoreBackupMutation,
  useSaveBackupSecretsMutation,
  useTriggerBackupMutation,
} from "@/hooks/queries/useBackupRuns";

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

  const { data: runs = [] } = useBackupRunsQuery();
  const triggerBackupMutation = useTriggerBackupMutation();
  const downloadBackupMutation = useDownloadBackupMutation();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [restoreTarget, setRestoreTarget] = useState<BackupRun | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [includeFiles, setIncludeFiles] = useState(true);
  const restoreBackupMutation = useRestoreBackupMutation();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { data: approvals = [] } = useRestoreApprovalsQuery();
  const decideRestoreApprovalMutation = useDecideRestoreApprovalMutation();
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const { data: secretsSettings } = useBackupSecretsSettingsQuery();
  const configured = secretsSettings?.configured ?? {};
  const [webhookUrl, setWebhookUrl] = useState("");
  const [offsiteUrl, setOffsiteUrl] = useState("");
  const [offsiteKey, setOffsiteKey] = useState("");
  const [offsiteIncludeFiles, setOffsiteIncludeFiles] = useState(false);
  const saveBackupSecretsMutation = useSaveBackupSecretsMutation();

  const running = triggerBackupMutation.isPending;
  const restoring = restoreBackupMutation.isPending;
  const savingSettings = saveBackupSecretsMutation.isPending;

  useEffect(() => {
    if (secretsSettings) setOffsiteIncludeFiles(secretsSettings.offsiteIncludeFiles);
  }, [secretsSettings]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const runNow = async () => {
    try {
      await triggerBackupMutation.mutateAsync();
      toast.success(lang === "ar" ? "تم إنشاء نسخة احتياطية" : "Backup created");
    } catch (e: any) {
      toast.error(e.message || (lang === "ar" ? "فشل إنشاء النسخة الاحتياطية" : "Backup failed"));
    }
  };

  const download = async (run: BackupRun) => {
    if (!run.file_path) return;
    setDownloadingId(run.id);
    try {
      const signedUrl = await downloadBackupMutation.mutateAsync(run);
      if (signedUrl) window.open(signedUrl, "_blank");
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
    try {
      const data = await restoreBackupMutation.mutateAsync({
        backup_folder: restoreTarget.backup_folder,
        mode: restoreMode,
        includeFiles,
      });
      if (data?.pending) {
        toast.success(lang === "ar"
          ? "تم إرسال طلب الاسترداد، يحتاج موافقة مسؤول آخر قبل التنفيذ"
          : "Restore request submitted — needs approval from another admin before it runs");
      } else {
        toast.success(lang === "ar" ? "تم استرداد البيانات بنجاح" : "Data restored successfully");
      }
      setRestoreTarget(null);
    } catch (e: any) {
      toast.error(e.message || (lang === "ar" ? "فشل الاسترداد" : "Restore failed"));
    }
  };

  const confirmRestore = () => {
    if (restoreMode === "replace") {
      requestDelete({
        message: lang === "ar"
          ? "سيتم تقديم طلب استبدال كامل للبيانات الحالية بمحتوى هذه النسخة الاحتياطية. لن يُنفَّذ فوراً - يجب أن يوافق عليه مسؤول آخر غيرك أولاً. عند التنفيذ، سيُؤخذ تلقائياً نسخة احتياطية فورية من الوضع الحالي قبل البدء يمكن الاسترجاع منها إن احتجت التراجع."
          : "This will file a request to fully replace current data with this backup. It will NOT run immediately - a different admin must approve it first. Once it runs, a safety backup of the current state is taken automatically first, so you can undo this if needed.",
        onConfirm: doRestore,
      });
    } else {
      doRestore();
    }
  };

  const decide = async (approval: RestoreApproval, action: "approve" | "reject") => {
    setDecidingId(approval.id);
    try {
      await decideRestoreApprovalMutation.mutateAsync({ approval_id: approval.id, action });
      toast.success(
        action === "approve"
          ? (lang === "ar" ? "تمت الموافقة وتنفيذ الاسترداد" : "Approved — restore executed")
          : (lang === "ar" ? "تم رفض الطلب" : "Request rejected")
      );
    } catch (e: any) {
      toast.error(e.message || (lang === "ar" ? "فشل تنفيذ الإجراء" : "Action failed"));
    } finally {
      setDecidingId(null);
    }
  };

  const confirmApprove = (approval: RestoreApproval) => {
    requestDelete({
      message: lang === "ar"
        ? "ستوافق الآن على استبدال كامل للبيانات الحالية بمحتوى النسخة الاحتياطية المطلوبة، وسيُنفَّذ فوراً بعد الموافقة."
        : "You're about to approve a full replace of current data with the requested backup — it will execute immediately once approved.",
      onConfirm: () => decide(approval, "approve"),
    });
  };

  const saveSettings = async () => {
    const updates: { key: string; value: string }[] = [
      { key: SECRET_KEYS.offsiteIncludeFiles, value: offsiteIncludeFiles ? "true" : "false" },
    ];
    if (webhookUrl.trim()) updates.push({ key: SECRET_KEYS.webhook, value: webhookUrl.trim() });
    if (offsiteUrl.trim()) updates.push({ key: SECRET_KEYS.offsiteUrl, value: offsiteUrl.trim() });
    if (offsiteKey.trim()) updates.push({ key: SECRET_KEYS.offsiteKey, value: offsiteKey.trim() });

    try {
      await saveBackupSecretsMutation.mutateAsync(updates);
      toast.success(lang === "ar" ? "تم حفظ إعدادات الحماية" : "Protection settings saved");
      setWebhookUrl("");
      setOffsiteUrl("");
      setOffsiteKey("");
    } catch (e: any) {
      toast.error(e.message || (lang === "ar" ? "فشل الحفظ" : "Save failed"));
    }
  };

  const locale = lang === "ar" ? arLocale : enUS;

  return (
    <div className="space-y-4">
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
        {approvals.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-500/10 p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <ShieldAlert className="w-4 h-4" />
              {lang === "ar" ? "طلبات استرداد كامل تنتظر موافقة مسؤول آخر" : "Full-replace restores awaiting another admin's approval"}
            </div>
            <ul className="space-y-2">
              {approvals.map((a) => {
                const isOwnRequest = a.requested_by === currentUserId;
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 bg-background rounded-md border p-2">
                    <div className="min-w-0 text-xs">
                      <div className="font-medium truncate">
                        {a.requested_by_email || (lang === "ar" ? "مسؤول" : "An admin")}
                        {" • "}
                        {new Date(a.created_at).toLocaleString(lang === "ar" ? "ar" : "en")}
                      </div>
                      <div className="text-muted-foreground">
                        {lang === "ar" ? "النسخة" : "Backup"}: {a.backup_folder}
                        {isOwnRequest && (lang === "ar" ? " • طلبك - يجب أن يوافق مسؤول آخر" : " • your request - a different admin must approve")}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm" variant="outline" className="gap-1 text-destructive"
                        disabled={decidingId === a.id}
                        onClick={() => decide(a, "reject")}
                      >
                        <X className="w-3.5 h-3.5" />
                        {lang === "ar" ? "رفض" : "Reject"}
                      </Button>
                      <Button
                        size="sm" variant="default" className="gap-1"
                        disabled={decidingId === a.id || isOwnRequest}
                        title={isOwnRequest ? (lang === "ar" ? "لا يمكنك الموافقة على طلبك" : "You can't approve your own request") : undefined}
                        onClick={() => confirmApprove(a)}
                      >
                        {decidingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {lang === "ar" ? "موافقة" : "Approve"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
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
                    {r.status !== "failed" && !!r.checksum_issues && (
                      <span className="text-amber-600 dark:text-amber-400"> • {r.checksum_issues} {lang === "ar" ? "تعارض checksum" : "checksum mismatch(es)"}</span>
                    )}
                    {r.status !== "failed" && r.offsite_status && r.offsite_status !== "not_configured" && (
                      <span className={r.offsite_status === "success" ? "" : "text-amber-600 dark:text-amber-400"}>
                        {" • "}{lang === "ar" ? "نسخة خارجية" : "offsite"}: {r.offsite_status}
                      </span>
                    )}
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
                        ? "يعيد كل شيء طبق الأصل لحالة النسخة الاحتياطية بالضبط، ويحذف كل ما أُضيف بعدها. يتطلب موافقة مسؤول آخر قبل التنفيذ."
                        : "Restores everything to exactly match the backup, deleting anything added since. Requires a different admin's approval before it runs."}
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
              {restoreMode === "replace"
                ? (lang === "ar" ? "تقديم طلب الاسترداد" : "Submit restore request")
                : (lang === "ar" ? "بدء الاسترداد" : "Start restore")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="w-4 h-4" />
          {lang === "ar" ? "إعدادات حماية النسخ الاحتياطي" : "Backup Protection Settings"}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {lang === "ar"
            ? "كل حقل هنا اختياري ومستقل. القيم محفوظة كأسرار ولن تُعرض مرة أخرى بعد الحفظ - أدخل قيمة جديدة فقط للحقول التي تريد تغييرها."
            : "Every field below is optional and independent. Values are stored as secrets and never shown again after saving — only fill in the fields you want to change."}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Webhook className="w-3.5 h-3.5" />
            {lang === "ar" ? "رابط تنبيهات خارجي (Slack / Discord)" : "Alert webhook URL (Slack / Discord)"}
            {configured[SECRET_KEYS.webhook] && (
              <Badge variant="secondary" className="gap-1"><ShieldCheck className="w-3 h-3" />{lang === "ar" ? "مُفعّل" : "configured"}</Badge>
            )}
          </Label>
          <Input
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {lang === "ar"
              ? "يتم إرسال تنبيه هنا عند فشل أو تحذير النسخ الاحتياطي أو الاسترداد، بشكل مستقل عن إشعارات التطبيق."
              : "An alert is POSTed here whenever a backup or restore fails or warns, independent of in-app notifications."}
          </p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Cloud className="w-3.5 h-3.5" />
            {lang === "ar" ? "رابط مشروع Supabase خارجي (نسخة احتياطية بعيدة)" : "Off-site Supabase project URL"}
            {configured[SECRET_KEYS.offsiteUrl] && (
              <Badge variant="secondary" className="gap-1"><ShieldCheck className="w-3 h-3" />{lang === "ar" ? "مُفعّل" : "configured"}</Badge>
            )}
          </Label>
          <Input
            type="url"
            placeholder="https://xxxxxxxx.supabase.co"
            value={offsiteUrl}
            onChange={(e) => setOffsiteUrl(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            {lang === "ar" ? "مفتاح service_role للمشروع الخارجي" : "Off-site project service_role key"}
            {configured[SECRET_KEYS.offsiteKey] && (
              <Badge variant="secondary" className="gap-1"><ShieldCheck className="w-3 h-3" />{lang === "ar" ? "مُفعّل" : "configured"}</Badge>
            )}
          </Label>
          <Input
            type="password"
            placeholder="••••••••••••••••"
            value={offsiteKey}
            onChange={(e) => setOffsiteKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {lang === "ar"
              ? "يجب إنشاء مشروع Supabase ثانٍ مستقل تماماً عن هذا المشروع، وإدخال رابطه ومفتاحه هنا، حتى لا تفقد نسخك الاحتياطية إذا فُقد هذا المشروع نفسه."
              : "Create a SECOND Supabase project, fully independent of this one, and enter its URL and key here — so losing this project doesn't also destroy its own backups."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="offsite-include-files"
            checked={offsiteIncludeFiles}
            onCheckedChange={(c) => setOffsiteIncludeFiles(!!c)}
          />
          <Label htmlFor="offsite-include-files" className="font-normal cursor-pointer">
            {lang === "ar"
              ? "نسخ الملفات أيضاً (وليس فقط بيانات الجداول) إلى المشروع الخارجي - أبطأ وأكثر تكلفة"
              : "Also replicate files (not just table data) to the off-site project — slower and costlier"}
          </Label>
        </div>

        <Button onClick={saveSettings} disabled={savingSettings} className="gap-2">
          {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {lang === "ar" ? "حفظ الإعدادات" : "Save settings"}
        </Button>
      </CardContent>
    </Card>
    </div>
  );
};

export default ScheduledBackups;
