import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle2, PlayCircle } from "lucide-react";
import {
  useRetentionPoliciesQuery, useUpdateRetentionPolicyMutation,
  usePrivacyRequestsQuery, useUpdatePrivacyRequestMutation,
  useRetentionAnalysisQuery, type PrivacyRequest, type RetentionPolicy,
} from "@/hooks/queries/useGDPRTools";

const REQUEST_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  processing: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-destructive/15 text-destructive",
};

const TYPE_LABEL = (t: string, ar: boolean) =>
  ar ? { access: "الاطلاع", deletion: "الحذف", correction: "التصحيح", portability: "النقل" }[t] ?? t : t;

const STATUS_LABEL = (s: string, ar: boolean) =>
  ar ? { pending: "معلّق", processing: "قيد المعالجة", completed: "مكتمل", rejected: "مرفوض" }[s] ?? s : s;

const ACTION_LABEL = (a: string, ar: boolean) =>
  ar ? { anonymize: "إخفاء الهوية", delete: "حذف", archive: "أرشفة" }[a] ?? a : a;

const ENTITY_LABEL = (e: string, ar: boolean) =>
  ar ? { applicants: "المتقدمون", audit_log: "سجل النظام", error_log: "سجل الأخطاء", notifications: "الإشعارات" }[e] ?? e : e;

const COMPLIANCE_CHECKS = [
  { ar: "تشفير كلمات المرور", en: "Password hashing", ok: true },
  { ar: "عزل البيانات بسياسات RLS", en: "Row-level security enabled", ok: true },
  { ar: "سجل تدقيق لكل العمليات", en: "Full audit trail", ok: true },
  { ar: "سياسات احتفاظ محددة", en: "Retention policies defined", ok: true },
  { ar: "قناة لطلبات الخصوصية", en: "Privacy request channel", ok: true },
  { ar: "نسخ احتياطية دورية", en: "Regular backups", ok: true },
];

export default function GDPRTools() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { data: policies = [], isLoading: policiesLoading } = useRetentionPoliciesQuery();
  const { data: requests = [], isLoading: requestsLoading } = usePrivacyRequestsQuery();
  const updatePolicyMutation = useUpdateRetentionPolicyMutation();
  const updateRequestMutation = useUpdatePrivacyRequestMutation();

  const [analysisOn, setAnalysisOn] = useState(false);
  const { data: analysis = [], isFetching: analyzing } = useRetentionAnalysisQuery(analysisOn);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
          <p className="text-sm text-muted-foreground">{ar ? "طلبات معلّقة" : "Pending Requests"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold">{policies.filter((p) => p.is_active).length}</p>
          <p className="text-sm text-muted-foreground">{ar ? "سياسات نشطة" : "Active Policies"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-emerald-600">{COMPLIANCE_CHECKS.filter((c) => c.ok).length}/{COMPLIANCE_CHECKS.length}</p>
          <p className="text-sm text-muted-foreground">{ar ? "متطلبات الامتثال" : "Compliance Checks"}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />{ar ? "سياسات الاحتفاظ بالبيانات" : "Data Retention Policies"}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setAnalysisOn(true)} disabled={analyzing} className="gap-1">
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              {ar ? "تحليل السجلات المتجاوزة" : "Run Analysis"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {policiesLoading ? (
            <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "نوع البيانات" : "Entity"}</TableHead>
                    <TableHead>{ar ? "مدة الاحتفاظ (يوم)" : "Retention (days)"}</TableHead>
                    <TableHead>{ar ? "الإجراء بعد الانتهاء" : "Action After"}</TableHead>
                    <TableHead>{ar ? "سجلات متجاوزة" : "Overdue Rows"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((p) => {
                    const found = analysis.find((a) => a.entity_type === p.entity_type);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{ENTITY_LABEL(p.entity_type, ar)}</TableCell>
                        <TableCell>
                          <Input type="number" className="h-7 w-24" defaultValue={p.retention_days}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (v !== p.retention_days) updatePolicyMutation.mutate({ id: p.id, patch: { retention_days: v } });
                            }} />
                        </TableCell>
                        <TableCell>
                          <Select value={p.action_after}
                            onValueChange={(v) => updatePolicyMutation.mutate({ id: p.id, patch: { action_after: v as RetentionPolicy["action_after"] } })}>
                            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["archive", "anonymize", "delete"].map((a) => (
                                <SelectItem key={a} value={a}>{ACTION_LABEL(a, ar)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {!analysisOn ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : analyzing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : found?.overdue === -1 ? (
                            <span className="text-xs text-muted-foreground">{ar ? "غير متاح" : "N/A"}</span>
                          ) : (found?.overdue ?? 0) > 0 ? (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 gap-1">
                              <AlertTriangle className="w-3 h-3" />{found?.overdue}
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">0</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{ar ? "طلبات الخصوصية" : "Privacy Requests"}</CardTitle></CardHeader>
        <CardContent>
          {requestsLoading ? (
            <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : requests.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{ar ? "لا توجد طلبات" : "No requests"}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{ar ? "النوع" : "Type"}</TableHead>
                    <TableHead>{ar ? "مقدّم الطلب" : "Requester"}</TableHead>
                    <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell><Badge variant="outline">{TYPE_LABEL(r.request_type, ar)}</Badge></TableCell>
                      <TableCell className="text-sm">
                        {r.requester_name || "—"}
                        <span className="block text-xs text-muted-foreground">{r.requester_email}</span>
                      </TableCell>
                      <TableCell>
                        <Select value={r.status}
                          onValueChange={(v) => updateRequestMutation.mutate({ id: r.id, status: v as PrivacyRequest["status"] })}>
                          <SelectTrigger className={`h-7 w-36 text-xs ${REQUEST_STYLE[r.status]}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["pending", "processing", "completed", "rejected"].map((s) => (
                              <SelectItem key={s} value={s}>{STATUS_LABEL(s, ar)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{ar ? "قائمة التحقق من الامتثال" : "Compliance Checklist"}</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {COMPLIANCE_CHECKS.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                {c.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                {ar ? c.ar : c.en}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
