import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, Plus, Trash2, Loader2, Wallet } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  useBudgetsQuery, useHiringCostsQuery, useHiredCountQuery,
  useUpsertBudgetMutation, useAddCostMutation, useDeleteCostMutation,
  type CostType,
} from "@/hooks/queries/useBudgetTracking";

const COST_TYPES: CostType[] = ["job_board", "agency", "referral_bonus", "interview", "assessment", "onboarding", "relocation", "other"];

const COST_LABEL = (t: string, ar: boolean) =>
  ar
    ? {
        job_board: "مواقع التوظيف", agency: "وكالة توظيف", referral_bonus: "مكافأة إحالة",
        interview: "مقابلات", assessment: "اختبارات", onboarding: "تأهيل",
        relocation: "انتقال", other: "أخرى",
      }[t] ?? t
    : t.replace(/_/g, " ");

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#f43f5e", "#64748b"];

export default function BudgetTracking() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { data: budgets = [], isLoading: budgetsLoading } = useBudgetsQuery();
  const { data: costs = [], isLoading: costsLoading } = useHiringCostsQuery();
  const { data: hiredCount = 0 } = useHiredCountQuery();
  const upsertBudgetMutation = useUpsertBudgetMutation();
  const addCostMutation = useAddCostMutation();
  const deleteCostMutation = useDeleteCostMutation();

  const [costOpen, setCostOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [costForm, setCostForm] = useState({
    cost_type: "job_board" as CostType, amount: "", department: "", description: "",
    cost_date: new Date().toISOString().slice(0, 10),
  });
  const [budgetForm, setBudgetForm] = useState({
    department: "", fiscal_year: String(new Date().getFullYear()), total_budget: "", notes: "",
  });

  const totals = useMemo(() => {
    const totalBudget = budgets.reduce((s, b) => s + Number(b.total_budget || 0), 0);
    const totalSpent = costs.reduce((s, c) => s + Number(c.amount || 0), 0);
    return {
      totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
      utilization: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
      costPerHire: hiredCount > 0 ? Math.round(totalSpent / hiredCount) : 0,
    };
  }, [budgets, costs, hiredCount]);

  const byDepartment = useMemo(() => {
    const map = new Map<string, { budget: number; spent: number }>();
    for (const b of budgets) {
      const e = map.get(b.department) ?? { budget: 0, spent: 0 };
      e.budget += Number(b.total_budget || 0);
      map.set(b.department, e);
    }
    for (const c of costs) {
      const dept = c.department || (ar ? "غير محدد" : "Unassigned");
      const e = map.get(dept) ?? { budget: 0, spent: 0 };
      e.spent += Number(c.amount || 0);
      map.set(dept, e);
    }
    return Array.from(map.entries()).map(([department, v]) => ({ department, ...v, remaining: v.budget - v.spent }));
  }, [budgets, costs, ar]);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of costs) {
      map.set(c.cost_type, (map.get(c.cost_type) ?? 0) + Number(c.amount || 0));
    }
    return Array.from(map.entries())
      .map(([type, value]) => ({ name: COST_LABEL(type, ar), value }))
      .sort((a, b) => b.value - a.value);
  }, [costs, ar]);

  const submitCost = () => {
    if (!costForm.amount) return;
    addCostMutation.mutate(
      {
        cost_type: costForm.cost_type,
        amount: Number(costForm.amount),
        department: costForm.department || null,
        description: costForm.description || null,
        cost_date: costForm.cost_date,
      },
      { onSuccess: () => { setCostOpen(false); setCostForm({ ...costForm, amount: "", description: "" }); } }
    );
  };

  const submitBudget = () => {
    if (!budgetForm.department.trim() || !budgetForm.total_budget) return;
    upsertBudgetMutation.mutate(
      {
        department: budgetForm.department,
        fiscal_year: Number(budgetForm.fiscal_year),
        total_budget: Number(budgetForm.total_budget),
        notes: budgetForm.notes || undefined,
      },
      { onSuccess: () => { setBudgetOpen(false); setBudgetForm({ ...budgetForm, department: "", total_budget: "", notes: "" }); } }
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-bold">{totals.totalBudget.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{ar ? "إجمالي الميزانية" : "Total Budget"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-bold text-amber-600">{totals.totalSpent.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{ar ? "المصروف" : "Spent"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className={`text-2xl font-bold ${totals.remaining < 0 ? "text-destructive" : "text-emerald-600"}`}>
            {totals.remaining.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">{ar ? "المتبقي" : "Remaining"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-bold">{totals.utilization}%</p>
          <Progress value={Math.min(totals.utilization, 100)} className="h-1.5 mt-1" />
          <p className="text-sm text-muted-foreground mt-1">{ar ? "نسبة الاستهلاك" : "Utilization"}</p>
        </CardContent></Card>
        <Card className="border-primary/30"><CardContent className="pt-6 text-center">
          <Wallet className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-2xl font-bold text-primary">{totals.costPerHire.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{ar ? "تكلفة التوظيف الواحد" : "Cost per Hire"}</p>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{ar ? "الميزانية حسب القسم" : "Budget by Department"}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setBudgetOpen(true)} className="gap-1">
                <Plus className="w-4 h-4" />{ar ? "ميزانية" : "Budget"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {budgetsLoading ? (
              <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : byDepartment.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">{ar ? "لا توجد ميزانيات" : "No budgets set"}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "القسم" : "Department"}</TableHead>
                    <TableHead>{ar ? "الميزانية" : "Budget"}</TableHead>
                    <TableHead>{ar ? "المصروف" : "Spent"}</TableHead>
                    <TableHead>{ar ? "المتبقي" : "Remaining"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byDepartment.map((d) => (
                    <TableRow key={d.department}>
                      <TableCell className="font-medium">{d.department}</TableCell>
                      <TableCell>{d.budget.toLocaleString()}</TableCell>
                      <TableCell className="text-amber-600">{d.spent.toLocaleString()}</TableCell>
                      <TableCell className={d.remaining < 0 ? "text-destructive font-bold" : "text-emerald-600"}>
                        {d.remaining.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{ar ? "توزيع التكاليف" : "Cost Breakdown"}</CardTitle></CardHeader>
          <CardContent>
            {byType.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">{ar ? "لا توجد تكاليف مسجلة" : "No costs recorded"}</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
                    {byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />{ar ? "سجل التكاليف" : "Cost Entries"}
            </CardTitle>
            <Button size="sm" onClick={() => setCostOpen(true)} className="gap-1">
              <Plus className="w-4 h-4" />{ar ? "تكلفة جديدة" : "Add Cost"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {costsLoading ? (
            <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : costs.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">{ar ? "لا توجد تكاليف" : "No costs"}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{ar ? "النوع" : "Type"}</TableHead>
                    <TableHead>{ar ? "القسم" : "Department"}</TableHead>
                    <TableHead>{ar ? "المبلغ" : "Amount"}</TableHead>
                    <TableHead>{ar ? "الوصف" : "Description"}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costs.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{c.cost_date}</TableCell>
                      <TableCell><Badge variant="outline">{COST_LABEL(c.cost_type, ar)}</Badge></TableCell>
                      <TableCell className="text-sm">{c.department || "—"}</TableCell>
                      <TableCell className="font-medium">{Number(c.amount).toLocaleString()} {c.currency}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{c.description || "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                          onClick={() => deleteCostMutation.mutate(c.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={costOpen} onOpenChange={setCostOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{ar ? "تسجيل تكلفة" : "Add Cost"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>{ar ? "نوع التكلفة" : "Cost Type"}</Label>
              <Select value={costForm.cost_type} onValueChange={(v) => setCostForm({ ...costForm, cost_type: v as CostType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COST_TYPES.map((t) => <SelectItem key={t} value={t}>{COST_LABEL(t, ar)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{ar ? "المبلغ *" : "Amount *"}</Label>
                <Input type="number" value={costForm.amount} onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })} />
              </div>
              <div>
                <Label>{ar ? "التاريخ" : "Date"}</Label>
                <Input type="date" value={costForm.cost_date} onChange={(e) => setCostForm({ ...costForm, cost_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{ar ? "القسم" : "Department"}</Label>
              <Input value={costForm.department} onChange={(e) => setCostForm({ ...costForm, department: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "الوصف" : "Description"}</Label>
              <Textarea rows={2} value={costForm.description} onChange={(e) => setCostForm({ ...costForm, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCostOpen(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={submitCost} disabled={addCostMutation.isPending || !costForm.amount}>
              {addCostMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-1" />}
              {ar ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{ar ? "تحديد ميزانية قسم" : "Set Department Budget"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>{ar ? "القسم *" : "Department *"}</Label>
              <Input value={budgetForm.department} onChange={(e) => setBudgetForm({ ...budgetForm, department: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{ar ? "السنة المالية" : "Fiscal Year"}</Label>
                <Input type="number" value={budgetForm.fiscal_year} onChange={(e) => setBudgetForm({ ...budgetForm, fiscal_year: e.target.value })} />
              </div>
              <div>
                <Label>{ar ? "الميزانية *" : "Budget *"}</Label>
                <Input type="number" value={budgetForm.total_budget} onChange={(e) => setBudgetForm({ ...budgetForm, total_budget: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{ar ? "ملاحظات" : "Notes"}</Label>
              <Textarea rows={2} value={budgetForm.notes} onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetOpen(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={submitBudget} disabled={upsertBudgetMutation.isPending || !budgetForm.department.trim() || !budgetForm.total_budget}>
              {upsertBudgetMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-1" />}
              {ar ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
