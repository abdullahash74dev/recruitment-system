import { useMemo, useState } from "react";
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
import { ClipboardList, Plus, Check, X, Trash2, Loader2 } from "lucide-react";
import {
  useJobRequisitionsQuery,
  useCreateRequisitionMutation,
  useUpdateRequisitionMutation,
  useApproveRequisitionMutation,
  useRejectRequisitionMutation,
  useDeleteRequisitionMutation,
  type JobRequisition,
} from "@/hooks/queries/useJobRequisitions";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-destructive/15 text-destructive",
  on_hold: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  fulfilled: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
};

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  urgent: "bg-destructive/15 text-destructive",
};

const STATUS_LABEL = (s: string, ar: boolean) =>
  ar
    ? { draft: "مسودة", pending_approval: "بانتظار الموافقة", approved: "موافق عليه", rejected: "مرفوض", on_hold: "معلّق", fulfilled: "مُنجز" }[s] ?? s
    : s.replace(/_/g, " ");

const PRIORITY_LABEL = (p: string, ar: boolean) =>
  ar ? { low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة" }[p] ?? p : p;

const TYPE_LABEL = (t: string, ar: boolean) =>
  ar ? { full_time: "دوام كامل", part_time: "دوام جزئي", contract: "عقد", intern: "تدريب" }[t] ?? t : t.replace(/_/g, " ");

const EMPTY = {
  title: "", department: "", headcount: 1, justification: "", required_skills: "",
  salary_range_min: "", salary_range_max: "", employment_type: "full_time",
  priority: "medium", target_start_date: "", notes: "",
};

export default function JobRequisitions() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { data: rows = [], isLoading } = useJobRequisitionsQuery();
  const createMutation = useCreateRequisitionMutation();
  const updateMutation = useUpdateRequisitionMutation();
  const approveMutation = useApproveRequisitionMutation();
  const rejectMutation = useRejectRequisitionMutation();
  const deleteMutation = useDeleteRequisitionMutation();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string | number>>({ ...EMPTY });
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<JobRequisition | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (statusFilter === "all" || r.status === statusFilter) &&
          (priorityFilter === "all" || r.priority === priorityFilter)
      ),
    [rows, statusFilter, priorityFilter]
  );

  const stats = useMemo(() => {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    return {
      pending: rows.filter((r) => r.status === "pending_approval").length,
      approvedThisMonth: rows.filter(
        (r) => r.status === "approved" && r.approved_at && new Date(r.approved_at) >= thisMonth
      ).length,
      totalHeadcount: rows.filter((r) => r.status === "approved").reduce((sum, r) => sum + (r.headcount || 0), 0),
    };
  }, [rows]);

  const submit = () => {
    if (!String(form.title).trim()) return;
    createMutation.mutate(
      {
        title: String(form.title),
        department: String(form.department) || null,
        headcount: Number(form.headcount) || 1,
        justification: String(form.justification) || null,
        required_skills: String(form.required_skills) || null,
        salary_range_min: form.salary_range_min ? Number(form.salary_range_min) : null,
        salary_range_max: form.salary_range_max ? Number(form.salary_range_max) : null,
        employment_type: form.employment_type as JobRequisition["employment_type"],
        priority: form.priority as JobRequisition["priority"],
        target_start_date: String(form.target_start_date) || null,
        notes: String(form.notes) || null,
        status: "pending_approval",
      },
      { onSuccess: () => { setOpen(false); setForm({ ...EMPTY }); } }
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
          <p className="text-sm text-muted-foreground">{ar ? "بانتظار الموافقة" : "Pending Approval"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-emerald-600">{stats.approvedThisMonth}</p>
          <p className="text-sm text-muted-foreground">{ar ? "موافق عليه هذا الشهر" : "Approved This Month"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold">{stats.totalHeadcount}</p>
          <p className="text-sm text-muted-foreground">{ar ? "إجمالي الشواغر المعتمدة" : "Approved Headcount"}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              {ar ? "طلبات شغل الوظائف" : "Job Requisitions"}
            </CardTitle>
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1">
              <Plus className="w-4 h-4" />{ar ? "طلب جديد" : "New Request"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الحالات" : "All statuses"}</SelectItem>
                {["draft", "pending_approval", "approved", "rejected", "on_hold", "fulfilled"].map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL(s, ar)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الأولويات" : "All priorities"}</SelectItem>
                {["low", "medium", "high", "urgent"].map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABEL(p, ar)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">{ar ? "لا توجد طلبات" : "No requisitions"}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "المسمى" : "Title"}</TableHead>
                    <TableHead>{ar ? "القسم" : "Department"}</TableHead>
                    <TableHead>{ar ? "العدد" : "Count"}</TableHead>
                    <TableHead>{ar ? "الأولوية" : "Priority"}</TableHead>
                    <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{ar ? "إجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.title}
                        <span className="block text-xs text-muted-foreground">{TYPE_LABEL(r.employment_type, ar)}</span>
                      </TableCell>
                      <TableCell>{r.department || "—"}</TableCell>
                      <TableCell>{r.headcount}</TableCell>
                      <TableCell><Badge className={PRIORITY_STYLE[r.priority]}>{PRIORITY_LABEL(r.priority, ar)}</Badge></TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLE[r.status]}>{STATUS_LABEL(r.status, ar)}</Badge>
                        {r.rejection_reason && <span className="block text-xs text-destructive mt-1">{r.rejection_reason}</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {r.status === "pending_approval" && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-600"
                                onClick={() => approveMutation.mutate(r.id)}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                                onClick={() => { setRejectTarget(r); setRejectReason(""); }}>
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {r.status === "approved" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                              onClick={() => updateMutation.mutate({ id: r.id, patch: { status: "fulfilled" } })}>
                              {ar ? "تم الشغل" : "Fulfilled"}
                            </Button>
                          )}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{ar ? "طلب شغل وظيفة جديد" : "New Job Requisition"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>{ar ? "المسمى الوظيفي *" : "Job Title *"}</Label>
              <Input value={String(form.title)} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "القسم" : "Department"}</Label>
              <Input value={String(form.department)} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "عدد الشواغر" : "Headcount"}</Label>
              <Input type="number" min={1} value={String(form.headcount)} onChange={(e) => setForm({ ...form, headcount: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "نوع التوظيف" : "Employment Type"}</Label>
              <Select value={String(form.employment_type)} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["full_time", "part_time", "contract", "intern"].map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABEL(t, ar)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{ar ? "الأولوية" : "Priority"}</Label>
              <Select value={String(form.priority)} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low", "medium", "high", "urgent"].map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABEL(p, ar)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{ar ? "الراتب من" : "Salary From"}</Label>
              <Input type="number" value={String(form.salary_range_min)} onChange={(e) => setForm({ ...form, salary_range_min: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "الراتب إلى" : "Salary To"}</Label>
              <Input type="number" value={String(form.salary_range_max)} onChange={(e) => setForm({ ...form, salary_range_max: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>{ar ? "تاريخ البدء المستهدف" : "Target Start Date"}</Label>
              <Input type="date" value={String(form.target_start_date)} onChange={(e) => setForm({ ...form, target_start_date: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>{ar ? "المبرر" : "Justification"}</Label>
              <Textarea rows={2} value={String(form.justification)} onChange={(e) => setForm({ ...form, justification: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>{ar ? "المهارات المطلوبة" : "Required Skills"}</Label>
              <Textarea rows={2} value={String(form.required_skills)} onChange={(e) => setForm({ ...form, required_skills: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={submit} disabled={createMutation.isPending || !String(form.title).trim()}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-1" />}
              {ar ? "إرسال للموافقة" : "Submit for Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{ar ? "سبب الرفض" : "Rejection Reason"}</DialogTitle></DialogHeader>
          <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
            placeholder={ar ? "اذكر سبب رفض الطلب..." : "Why is this being rejected..."} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button variant="destructive" disabled={!rejectReason.trim()}
              onClick={() => {
                if (rejectTarget) rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason });
                setRejectTarget(null);
              }}>
              {ar ? "رفض الطلب" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
