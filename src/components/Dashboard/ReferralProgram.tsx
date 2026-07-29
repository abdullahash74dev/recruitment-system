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
import { UserPlus2, Plus, Trash2, Loader2, BadgeCheck } from "lucide-react";
import {
  useReferralsQuery,
  useCreateReferralMutation,
  useUpdateReferralMutation,
  useMarkRewardPaidMutation,
  useDeleteReferralMutation,
  type Referral,
} from "@/hooks/queries/useReferrals";

const STATUSES = ["submitted", "reviewing", "interviewing", "hired", "rejected", "withdrawn"] as const;

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  reviewing: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  interviewing: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  hired: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-destructive/15 text-destructive",
  withdrawn: "bg-muted text-muted-foreground",
};

const STATUS_LABEL = (s: string, ar: boolean) =>
  ar
    ? { submitted: "مُقدَّم", reviewing: "قيد المراجعة", interviewing: "مقابلة", hired: "تم التوظيف", rejected: "مرفوض", withdrawn: "منسحب" }[s] ?? s
    : s;

const EMPTY = {
  candidate_name: "", candidate_email: "", candidate_phone: "",
  position_applied: "", relationship: "", notes: "", referrer_name: "",
};

export default function ReferralProgram() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { data: rows = [], isLoading } = useReferralsQuery();
  const createMutation = useCreateReferralMutation();
  const updateMutation = useUpdateReferralMutation();
  const payMutation = useMarkRewardPaidMutation();
  const deleteMutation = useDeleteReferralMutation();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(
    () => rows.filter((r) => statusFilter === "all" || r.status === statusFilter),
    [rows, statusFilter]
  );

  const stats = useMemo(() => ({
    total: rows.length,
    hired: rows.filter((r) => r.status === "hired").length,
    pendingReward: rows.filter((r) => r.status === "hired" && !r.reward_paid).reduce((s, r) => s + Number(r.reward_amount || 0), 0),
    paidReward: rows.filter((r) => r.reward_paid).reduce((s, r) => s + Number(r.reward_amount || 0), 0),
  }), [rows]);

  const submit = () => {
    if (!form.candidate_name.trim()) return;
    createMutation.mutate(
      {
        candidate_name: form.candidate_name,
        candidate_email: form.candidate_email || null,
        candidate_phone: form.candidate_phone || null,
        position_applied: form.position_applied || null,
        relationship: form.relationship || null,
        notes: form.notes || null,
        referrer_name: form.referrer_name || null,
      },
      { onSuccess: () => { setOpen(false); setForm({ ...EMPTY }); } }
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">{ar ? "إجمالي الإحالات" : "Total Referrals"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-emerald-600">{stats.hired}</p>
          <p className="text-sm text-muted-foreground">{ar ? "تم توظيفهم" : "Hired"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-amber-600">{stats.pendingReward.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{ar ? "مكافآت مستحقة" : "Pending Rewards"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-blue-600">{stats.paidReward.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{ar ? "مكافآت مصروفة" : "Paid Rewards"}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <UserPlus2 className="w-5 h-5" />{ar ? "برنامج الإحالة" : "Referral Program"}
            </CardTitle>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ar ? "كل الحالات" : "All statuses"}</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL(s, ar)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setOpen(true)} className="gap-1">
                <Plus className="w-4 h-4" />{ar ? "إحالة جديدة" : "New Referral"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">{ar ? "لا توجد إحالات" : "No referrals"}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "المرشح" : "Candidate"}</TableHead>
                    <TableHead>{ar ? "المُحيل" : "Referrer"}</TableHead>
                    <TableHead>{ar ? "الوظيفة" : "Position"}</TableHead>
                    <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{ar ? "المكافأة" : "Reward"}</TableHead>
                    <TableHead>{ar ? "إجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.candidate_name}
                        <span className="block text-xs text-muted-foreground">{r.candidate_email || r.candidate_phone || "—"}</span>
                      </TableCell>
                      <TableCell className="text-sm">{r.referrer_name || r.referrer_email || "—"}</TableCell>
                      <TableCell className="text-sm">{r.position_applied || "—"}</TableCell>
                      <TableCell>
                        <Select value={r.status} onValueChange={(v) => updateMutation.mutate({ id: r.id, patch: { status: v as Referral["status"] } })}>
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL(s, ar)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Badge className={`${STATUS_STYLE[r.status]} mt-1 text-[10px]`}>{STATUS_LABEL(r.status, ar)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input type="number" className="h-7 w-24 text-xs" defaultValue={r.reward_amount}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (v !== Number(r.reward_amount)) updateMutation.mutate({ id: r.id, patch: { reward_amount: v } });
                            }} />
                          <span className="text-xs text-muted-foreground">{r.reward_currency}</span>
                        </div>
                        {r.reward_paid && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 mt-1 text-[10px] gap-1">
                            <BadgeCheck className="w-3 h-3" />{ar ? "مصروفة" : "Paid"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!r.reward_paid && r.status === "hired" && Number(r.reward_amount) > 0 && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                              onClick={() => payMutation.mutate(r.id)}>
                              {ar ? "صرف" : "Pay"}
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{ar ? "إحالة مرشح جديد" : "Refer a Candidate"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>{ar ? "اسم المرشح *" : "Candidate Name *"}</Label>
              <Input value={form.candidate_name} onChange={(e) => setForm({ ...form, candidate_name: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{ar ? "البريد الإلكتروني" : "Email"}</Label>
                <Input type="email" value={form.candidate_email} onChange={(e) => setForm({ ...form, candidate_email: e.target.value })} />
              </div>
              <div>
                <Label>{ar ? "الجوال" : "Phone"}</Label>
                <Input value={form.candidate_phone} onChange={(e) => setForm({ ...form, candidate_phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{ar ? "الوظيفة المرشح لها" : "Position"}</Label>
              <Input value={form.position_applied} onChange={(e) => setForm({ ...form, position_applied: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "اسمك (المُحيل)" : "Your Name (Referrer)"}</Label>
              <Input value={form.referrer_name} onChange={(e) => setForm({ ...form, referrer_name: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "صلتك بالمرشح" : "Your Relationship"}</Label>
              <Input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                placeholder={ar ? "زميل سابق، صديق..." : "Former colleague, friend..."} />
            </div>
            <div>
              <Label>{ar ? "ملاحظات" : "Notes"}</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={submit} disabled={createMutation.isPending || !form.candidate_name.trim()}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-1" />}
              {ar ? "إرسال" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
