import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Zap, Plus, Trash2, Loader2, Play, CheckCircle2, XCircle } from "lucide-react";
import {
  useAutomationRulesQuery, useAutomationLogsQuery,
  useCreateAutomationRuleMutation, useUpdateAutomationRuleMutation,
  useDeleteAutomationRuleMutation, useRunRuleMutation,
  type TriggerEvent, type ActionType,
} from "@/hooks/queries/useAutomationRules";

const TRIGGERS: TriggerEvent[] = ["applicant_created", "status_changed", "days_in_stage", "daily_check"];
const ACTIONS: ActionType[] = ["change_status", "send_notification", "assign_tag", "log_note"];

const TRIGGER_LABEL = (t: string, ar: boolean) =>
  ar
    ? {
        applicant_created: "عند إضافة متقدم", status_changed: "عند تغيير الحالة",
        days_in_stage: "بقاء في مرحلة لعدد أيام", daily_check: "فحص يومي",
      }[t] ?? t
    : t.replace(/_/g, " ");

const ACTION_LABEL = (a: string, ar: boolean) =>
  ar
    ? { change_status: "تغيير الحالة", send_notification: "إرسال إشعار", assign_tag: "إضافة وسم", log_note: "تسجيل ملاحظة" }[a] ?? a
    : a.replace(/_/g, " ");

const TEMPLATES = [
  {
    ar: "رفض تلقائي بعد 30 يوماً في المراجعة", en: "Auto-reject after 30 days in review",
    values: { name: "رفض تلقائي بعد 30 يوم", trigger_event: "days_in_stage" as TriggerEvent, trigger_condition_field: "reviewing", trigger_condition_value: "30", action_type: "change_status" as ActionType, action_value: "rejected" },
  },
  {
    ar: "نقل الجدد للمراجعة بعد 3 أيام", en: "Move new to reviewing after 3 days",
    values: { name: "نقل الجدد للمراجعة", trigger_event: "days_in_stage" as TriggerEvent, trigger_condition_field: "new", trigger_condition_value: "3", action_type: "change_status" as ActionType, action_value: "reviewing" },
  },
  {
    ar: "تنبيه للمقابلات الهاتفية المتأخرة", en: "Flag stale phone interviews",
    values: { name: "تنبيه مقابلات متأخرة", trigger_event: "days_in_stage" as TriggerEvent, trigger_condition_field: "phone_interview", trigger_condition_value: "14", action_type: "log_note" as ActionType, action_value: "متأخر - يحتاج متابعة" },
  },
];

const EMPTY = {
  name: "", description: "", trigger_event: "days_in_stage" as TriggerEvent,
  trigger_condition_field: "reviewing", trigger_condition_value: "7",
  action_type: "change_status" as ActionType, action_value: "rejected",
};

export default function PipelineAutomation() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { data: rules = [], isLoading } = useAutomationRulesQuery();
  const { data: logs = [] } = useAutomationLogsQuery();
  const createMutation = useCreateAutomationRuleMutation();
  const updateMutation = useUpdateAutomationRuleMutation();
  const deleteMutation = useDeleteAutomationRuleMutation();
  const runMutation = useRunRuleMutation();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const today = new Date().toDateString();
  const runsToday = logs.filter((l) => new Date(l.ran_at).toDateString() === today).length;

  const submit = () => {
    if (!form.name.trim()) return;
    createMutation.mutate({ ...form }, { onSuccess: () => { setOpen(false); setForm({ ...EMPTY }); } });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-primary">{rules.filter((r) => r.is_active).length}</p>
          <p className="text-sm text-muted-foreground">{ar ? "قواعد نشطة" : "Active Rules"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold">{runsToday}</p>
          <p className="text-sm text-muted-foreground">{ar ? "تنفيذات اليوم" : "Runs Today"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-emerald-600">
            {logs.length > 0 ? Math.round((logs.filter((l) => l.success).length / logs.length) * 100) : 100}%
          </p>
          <p className="text-sm text-muted-foreground">{ar ? "معدل النجاح" : "Success Rate"}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />{ar ? "قواعد الأتمتة" : "Automation Rules"}
            </CardTitle>
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1">
              <Plus className="w-4 h-4" />{ar ? "قاعدة جديدة" : "New Rule"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center">{ar ? "قوالب جاهزة:" : "Templates:"}</span>
            {TEMPLATES.map((t, i) => (
              <Button key={i} size="sm" variant="outline" className="text-xs h-7"
                onClick={() => { setForm({ ...EMPTY, ...t.values, description: ar ? t.ar : t.en }); setOpen(true); }}>
                {ar ? t.ar : t.en}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : rules.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">{ar ? "لا توجد قواعد" : "No rules"}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "نشط" : "Active"}</TableHead>
                    <TableHead>{ar ? "الاسم" : "Name"}</TableHead>
                    <TableHead>{ar ? "المُشغِّل" : "Trigger"}</TableHead>
                    <TableHead>{ar ? "الإجراء" : "Action"}</TableHead>
                    <TableHead>{ar ? "التنفيذات" : "Runs"}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Switch checked={r.is_active}
                          onCheckedChange={(v) => updateMutation.mutate({ id: r.id, patch: { is_active: v } })} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.name}
                        {r.description && <span className="block text-xs text-muted-foreground">{r.description}</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="text-xs">{TRIGGER_LABEL(r.trigger_event, ar)}</Badge>
                        {r.trigger_condition_field && (
                          <span className="block text-xs text-muted-foreground mt-1">
                            {r.trigger_condition_field} · {r.trigger_condition_value}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="text-xs">{ACTION_LABEL(r.action_type, ar)}</Badge>
                        {r.action_value && <span className="block text-xs text-muted-foreground mt-1">{r.action_value}</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.run_count}
                        {r.last_run_at && (
                          <span className="block text-xs text-muted-foreground">
                            {new Date(r.last_run_at).toLocaleDateString()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" disabled={runMutation.isPending}
                            onClick={() => runMutation.mutate(r)} title={ar ? "تشغيل الآن" : "Run now"}>
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                            onClick={() => deleteMutation.mutate(r.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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
        <CardHeader><CardTitle>{ar ? "سجل التنفيذ" : "Run Log"}</CardTitle></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{ar ? "لا توجد تنفيذات بعد" : "No runs yet"}</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {logs.map((l) => {
                const rule = rules.find((r) => r.id === l.rule_id);
                return (
                  <div key={l.id} className="flex items-start gap-2 text-sm py-1.5 border-b last:border-0">
                    {l.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-xs">{rule?.name || (ar ? "قاعدة محذوفة" : "Deleted rule")}</p>
                      <p className="text-xs text-muted-foreground">{l.details}</p>
                    </div>
                    <span className="ms-auto text-xs text-muted-foreground shrink-0">
                      {new Date(l.ran_at).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{ar ? "قاعدة أتمتة جديدة" : "New Automation Rule"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>{ar ? "اسم القاعدة *" : "Rule Name *"}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "الوصف" : "Description"}</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "المُشغِّل" : "Trigger"}</Label>
              <Select value={form.trigger_event} onValueChange={(v) => setForm({ ...form, trigger_event: v as TriggerEvent })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((t) => <SelectItem key={t} value={t}>{TRIGGER_LABEL(t, ar)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{ar ? "المرحلة" : "Stage"}</Label>
                <Select value={form.trigger_condition_field} onValueChange={(v) => setForm({ ...form, trigger_condition_field: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["new", "reviewing", "phone_interview", "in_person_interview", "accepted"].map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{ar ? "عدد الأيام" : "Days"}</Label>
                <Input type="number" value={form.trigger_condition_value}
                  onChange={(e) => setForm({ ...form, trigger_condition_value: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{ar ? "الإجراء" : "Action"}</Label>
              <Select value={form.action_type} onValueChange={(v) => setForm({ ...form, action_type: v as ActionType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => <SelectItem key={a} value={a}>{ACTION_LABEL(a, ar)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{ar ? "قيمة الإجراء" : "Action Value"}</Label>
              {form.action_type === "change_status" ? (
                <Select value={form.action_value} onValueChange={(v) => setForm({ ...form, action_value: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["reviewing", "phone_interview", "in_person_interview", "accepted", "rejected", "withdrawn"].map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.action_value} onChange={(e) => setForm({ ...form, action_value: e.target.value })} />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={submit} disabled={createMutation.isPending || !form.name.trim()}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-1" />}
              {ar ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
