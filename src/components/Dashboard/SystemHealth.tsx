import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Database, HardDrive, RefreshCw, AlertTriangle, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useSystemUsageQuery, useErrorLogQuery, ErrorLogRow } from "@/hooks/queries/useSystemHealth";

const SEVERITY_COLOR: Record<string, string> = {
  debug: "bg-muted text-muted-foreground",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  error: "bg-destructive/15 text-destructive",
  critical: "bg-destructive/25 text-destructive font-semibold",
};

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

const SystemHealth = () => {
  const { lang } = useLanguage();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ErrorLogRow | null>(null);

  const usage = useSystemUsageQuery();
  const errors = useErrorLogQuery(severityFilter === "all" ? {} : { severity: severityFilter });

  const dbPct = usage.data?.db.limit_bytes ? (usage.data.db.used_bytes / usage.data.db.limit_bytes) * 100 : null;
  const storagePct = usage.data?.storage.limit_bytes
    ? (usage.data.storage.used_bytes / usage.data.storage.limit_bytes) * 100
    : null;

  const planLabel = usage.data?.plan
    ? usage.data.plan.charAt(0).toUpperCase() + usage.data.plan.slice(1)
    : lang === "ar" ? "غير معروفة" : "Unknown";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          {lang === "ar" ? "صحة النظام" : "System Health"}
        </h2>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => { usage.refetch(); errors.refetch(); }}
          disabled={usage.isFetching || errors.isFetching}
        >
          <RefreshCw className={`w-4 h-4 ${usage.isFetching || errors.isFetching ? "animate-spin" : ""}`} />
          {lang === "ar" ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {!usage.data?.plan && !usage.isLoading && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {lang === "ar"
              ? "حدود الخطة غير متوفرة بعد — أضف مفتاح SUPABASE_MGMT_TOKEN في أسرار Edge Functions لعرض الحد الأقصى الفعلي. الاستهلاك الفعلي أدناه دقيق بدون ذلك."
              : "Plan limits unavailable yet — add the SUPABASE_MGMT_TOKEN edge function secret to show real plan caps. Actual usage below is accurate regardless."}
          </span>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="w-4 h-4" />
              {lang === "ar" ? "قاعدة البيانات" : "Database"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={dbPct ?? 0} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatBytes(usage.data?.db.used_bytes)} {lang === "ar" ? "مستخدم" : "used"}</span>
              <span>{usage.data?.db.limit_bytes ? `${lang === "ar" ? "من" : "of"} ${formatBytes(usage.data.db.limit_bytes)}` : ""}</span>
            </div>
            <div className="text-xs text-muted-foreground">{lang === "ar" ? "الخطة" : "Plan"}: {planLabel}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <HardDrive className="w-4 h-4" />
              {lang === "ar" ? "التخزين (الملفات)" : "Storage (files)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={storagePct ?? 0} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatBytes(usage.data?.storage.used_bytes)} {lang === "ar" ? "مستخدم" : "used"}</span>
              <span>{usage.data?.storage.limit_bytes ? `${lang === "ar" ? "من" : "of"} ${formatBytes(usage.data.storage.limit_bytes)}` : ""}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{lang === "ar" ? "التخزين حسب الحزمة (Bucket)" : "Storage by bucket"}</CardTitle>
        </CardHeader>
        <CardContent>
          {usage.data?.storage.buckets.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usage.data.storage.buckets} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => formatBytes(v)} />
                  <YAxis type="category" dataKey="bucket_id" width={110} />
                  <Tooltip formatter={(v: number) => formatBytes(v)} />
                  <Bar dataKey="total_bytes" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-6 text-center">
              {usage.isLoading ? (lang === "ar" ? "جارٍ التحميل..." : "Loading...") : (lang === "ar" ? "لا توجد بيانات" : "No data")}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{lang === "ar" ? "أكبر الجداول (مساحة)" : "Biggest tables (by size)"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{lang === "ar" ? "الجدول" : "Table"}</TableHead>
                  <TableHead>{lang === "ar" ? "الحجم" : "Size"}</TableHead>
                  <TableHead>{lang === "ar" ? "عدد الصفوف التقريبي" : "Approx. rows"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usage.data?.biggest_tables ?? []).map((t) => (
                  <TableRow key={t.table_name}>
                    <TableCell className="font-mono text-xs">{t.table_name}</TableCell>
                    <TableCell className="text-sm">{formatBytes(t.total_bytes)}</TableCell>
                    <TableCell className="text-sm">{t.row_estimate.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {lang === "ar" ? "الأخطاء الأخيرة" : "Recent errors"}
            </CardTitle>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "ar" ? "كل المستويات" : "All severities"}</SelectItem>
                {["critical", "error", "warning", "info", "debug"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{lang === "ar" ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{lang === "ar" ? "المستوى" : "Severity"}</TableHead>
                  <TableHead>{lang === "ar" ? "المصدر" : "Source"}</TableHead>
                  <TableHead>{lang === "ar" ? "الرسالة" : "Message"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(errors.data?.rows.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {errors.isLoading ? (lang === "ar" ? "جارٍ التحميل..." : "Loading...") : (lang === "ar" ? "لا توجد أخطاء" : "No errors")}
                    </TableCell>
                  </TableRow>
                ) : (
                  errors.data!.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                      <TableCell><Badge className={SEVERITY_COLOR[r.severity] || ""} variant="secondary">{r.severity}</Badge></TableCell>
                      <TableCell className="text-xs">{r.source}</TableCell>
                      <TableCell className="text-sm max-w-md truncate">{r.message}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setSelected(r)}><Eye className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "تفاصيل الخطأ" : "Error details"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><b>{lang === "ar" ? "التاريخ" : "Date"}:</b> {new Date(selected.created_at).toLocaleString()}</div>
                <div><b>{lang === "ar" ? "المستوى" : "Severity"}:</b> {selected.severity}</div>
                <div><b>{lang === "ar" ? "المصدر" : "Source"}:</b> {selected.source}</div>
                <div><b>{lang === "ar" ? "المستخدم" : "User"}:</b> {selected.user_email || "—"}</div>
                <div className="col-span-2"><b>URL:</b> <span className="font-mono text-xs">{selected.url || "—"}</span></div>
              </div>
              <div>
                <div className="font-bold mb-1">{lang === "ar" ? "الرسالة" : "Message"}</div>
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-h-32 whitespace-pre-wrap">{selected.message}</pre>
              </div>
              {selected.stack && (
                <div>
                  <div className="font-bold mb-1">Stack</div>
                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-h-64 whitespace-pre-wrap">{selected.stack}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SystemHealth;
