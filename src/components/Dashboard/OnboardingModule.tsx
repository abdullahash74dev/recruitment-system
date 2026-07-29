import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GraduationCap, Plus, Trash2, Loader2, Check, ChevronDown, ChevronUp, X } from "lucide-react";
import {
  useOnboardingTemplatesQuery,
  useOnboardingChecklistsQuery,
  useCreateTemplateMutation,
  useDeleteTemplateMutation,
  useCreateChecklistMutation,
  useUpdateChecklistItemMutation,
  useDeleteChecklistMutation,
  type OnboardingChecklistItem,
} from "@/hooks/queries/useOnboarding";

const ITEM_STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  skipped: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

const ITEM_STATUS_LABEL = (s: string, ar: boolean) =>
  ar ? { pending: "معلّق", in_progress: "جارٍ", done: "مكتمل", skipped: "متجاوَز" }[s] ?? s : s.replace(/_/g, " ");

export default function OnboardingModule() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { data: templates = [], isLoading: templatesLoading } = useOnboardingTemplatesQuery();
  const { data: checklists = [], isLoading: checklistsLoading } = useOnboardingChecklistsQuery();
  const createTemplateMutation = useCreateTemplateMutation();
  const deleteTemplateMutation = useDeleteTemplateMutation();
  const createChecklistMutation = useCreateChecklistMutation();
  const updateItemMutation = useUpdateChecklistItemMutation();
  const deleteChecklistMutation = useDeleteChecklistMutation();

  const [templateOpen, setTemplateOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [templateForm, setTemplateForm] = useState({ name: "", description: "" });
  const [tasks, setTasks] = useState<{ task_name: string; task_description: string; due_days_after_start: number }[]>([
    { task_name: "", task_description: "", due_days_after_start: 1 },
  ]);
  const [checklistForm, setChecklistForm] = useState({ employee_name: "", start_date: "", template_id: "" });

  const submitTemplate = () => {
    const validTasks = tasks.filter((t) => t.task_name.trim());
    if (!templateForm.name.trim()) return;
    createTemplateMutation.mutate(
      { name: templateForm.name, description: templateForm.description, tasks: validTasks },
      {
        onSuccess: () => {
          setTemplateOpen(false);
          setTemplateForm({ name: "", description: "" });
          setTasks([{ task_name: "", task_description: "", due_days_after_start: 1 }]);
        },
      }
    );
  };

  const submitChecklist = () => {
    const template = templates.find((t) => t.id === checklistForm.template_id);
    if (!template || !checklistForm.employee_name.trim() || !checklistForm.start_date) return;
    createChecklistMutation.mutate(
      { employee_name: checklistForm.employee_name, start_date: checklistForm.start_date, template },
      { onSuccess: () => { setChecklistOpen(false); setChecklistForm({ employee_name: "", start_date: "", template_id: "" }); } }
    );
  };

  const progressOf = (items: OnboardingChecklistItem[] = []) => {
    if (items.length === 0) return 0;
    return Math.round((items.filter((i) => i.status === "done").length / items.length) * 100);
  };

  const isOverdue = (item: OnboardingChecklistItem) =>
    item.status !== "done" && item.status !== "skipped" && item.due_date && new Date(item.due_date) < new Date();

  const stats = useMemo(() => ({
    active: checklists.filter((c) => c.status !== "completed").length,
    completed: checklists.filter((c) => c.status === "completed").length,
    overdueItems: checklists.reduce((sum, c) => sum + (c.items ?? []).filter(isOverdue).length, 0),
  }), [checklists]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-blue-600">{stats.active}</p>
          <p className="text-sm text-muted-foreground">{ar ? "قوائم نشطة" : "Active Checklists"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-emerald-600">{stats.completed}</p>
          <p className="text-sm text-muted-foreground">{ar ? "مكتملة" : "Completed"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-destructive">{stats.overdueItems}</p>
          <p className="text-sm text-muted-foreground">{ar ? "مهام متأخرة" : "Overdue Tasks"}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="checklists">
        <TabsList>
          <TabsTrigger value="checklists">{ar ? "قوائم التأهيل" : "Checklists"}</TabsTrigger>
          <TabsTrigger value="templates">{ar ? "القوالب" : "Templates"}</TabsTrigger>
        </TabsList>

        <TabsContent value="checklists" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />{ar ? "قوائم تأهيل الموظفين" : "Employee Onboarding"}
                </CardTitle>
                <Button size="sm" onClick={() => setChecklistOpen(true)} disabled={templates.length === 0} className="gap-1">
                  <Plus className="w-4 h-4" />{ar ? "قائمة جديدة" : "New Checklist"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {checklistsLoading ? (
                <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
              ) : checklists.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  {templates.length === 0
                    ? (ar ? "أنشئ قالباً أولاً من تبويب القوالب" : "Create a template first")
                    : (ar ? "لا توجد قوائم تأهيل" : "No checklists")}
                </p>
              ) : (
                checklists.map((c) => {
                  const items = c.items ?? [];
                  const pct = progressOf(items);
                  const isOpen = expanded === c.id;
                  return (
                    <Card key={c.id} className="border-primary/20">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{c.employee_name || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {ar ? "تاريخ البدء: " : "Start: "}{c.start_date || "—"} · {items.filter((i) => i.status === "done").length}/{items.length}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge className={pct === 100 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-blue-500/15 text-blue-700 dark:text-blue-400"}>
                              {pct}%
                            </Badge>
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setExpanded(isOpen ? null : c.id)}>
                              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                              onClick={() => deleteChecklistMutation.mutate(c.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <Progress value={pct} className="h-2" />
                        {isOpen && (
                          <div className="space-y-1 pt-2">
                            {items.map((item) => (
                              <div key={item.id}
                                className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded text-sm ${isOverdue(item) ? "bg-destructive/5" : ""}`}>
                                <div className="min-w-0">
                                  <p className={item.status === "done" ? "line-through text-muted-foreground" : ""}>{item.task_name}</p>
                                  {item.due_date && (
                                    <p className={`text-xs ${isOverdue(item) ? "text-destructive" : "text-muted-foreground"}`}>
                                      {ar ? "الاستحقاق: " : "Due: "}{item.due_date}
                                    </p>
                                  )}
                                </div>
                                <Select value={item.status}
                                  onValueChange={(v) => updateItemMutation.mutate({ id: item.id, status: v as OnboardingChecklistItem["status"] })}>
                                  <SelectTrigger className={`h-7 w-28 text-xs ${ITEM_STATUS_STYLE[item.status]}`}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {["pending", "in_progress", "done", "skipped"].map((s) => (
                                      <SelectItem key={s} value={s}>{ITEM_STATUS_LABEL(s, ar)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{ar ? "قوالب التأهيل" : "Onboarding Templates"}</CardTitle>
                <Button size="sm" onClick={() => setTemplateOpen(true)} className="gap-1">
                  <Plus className="w-4 h-4" />{ar ? "قالب جديد" : "New Template"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {templatesLoading ? (
                <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
              ) : templates.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">{ar ? "لا توجد قوالب" : "No templates"}</p>
              ) : (
                templates.map((t) => (
                  <Card key={t.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{t.name}</p>
                          {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {(t.tasks ?? []).length} {ar ? "مهمة" : "tasks"}
                          </p>
                          <ul className="mt-2 space-y-0.5">
                            {(t.tasks ?? []).map((task) => (
                              <li key={task.id} className="text-xs text-muted-foreground flex items-center gap-1">
                                <Check className="w-3 h-3" />{task.task_name}
                                <span className="opacity-60">({ar ? `يوم +${task.due_days_after_start}` : `day +${task.due_days_after_start}`})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive shrink-0"
                          onClick={() => deleteTemplateMutation.mutate(t.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{ar ? "قالب تأهيل جديد" : "New Onboarding Template"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{ar ? "اسم القالب *" : "Template Name *"}</Label>
              <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "الوصف" : "Description"}</Label>
              <Textarea rows={2} value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "المهام" : "Tasks"}</Label>
              <div className="space-y-2 mt-1">
                {tasks.map((task, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Input className="flex-1" placeholder={ar ? "اسم المهمة" : "Task name"} value={task.task_name}
                      onChange={(e) => setTasks(tasks.map((t, j) => (j === i ? { ...t, task_name: e.target.value } : t)))} />
                    <Input type="number" className="w-24" placeholder={ar ? "يوم" : "Day"} value={task.due_days_after_start}
                      onChange={(e) => setTasks(tasks.map((t, j) => (j === i ? { ...t, due_days_after_start: Number(e.target.value) } : t)))} />
                    <Button size="sm" variant="ghost" className="h-9 px-2 text-destructive"
                      onClick={() => setTasks(tasks.filter((_, j) => j !== i))} disabled={tasks.length === 1}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="gap-1"
                  onClick={() => setTasks([...tasks, { task_name: "", task_description: "", due_days_after_start: 1 }])}>
                  <Plus className="w-4 h-4" />{ar ? "مهمة" : "Task"}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={submitTemplate} disabled={createTemplateMutation.isPending || !templateForm.name.trim()}>
              {createTemplateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-1" />}
              {ar ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checklistOpen} onOpenChange={setChecklistOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{ar ? "قائمة تأهيل جديدة" : "New Onboarding Checklist"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{ar ? "اسم الموظف *" : "Employee Name *"}</Label>
              <Input value={checklistForm.employee_name} onChange={(e) => setChecklistForm({ ...checklistForm, employee_name: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "تاريخ المباشرة *" : "Start Date *"}</Label>
              <Input type="date" value={checklistForm.start_date} onChange={(e) => setChecklistForm({ ...checklistForm, start_date: e.target.value })} />
            </div>
            <div>
              <Label>{ar ? "القالب *" : "Template *"}</Label>
              <Select value={checklistForm.template_id} onValueChange={(v) => setChecklistForm({ ...checklistForm, template_id: v })}>
                <SelectTrigger><SelectValue placeholder={ar ? "اختر قالباً" : "Select template"} /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({(t.tasks ?? []).length})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChecklistOpen(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={submitChecklist}
              disabled={createChecklistMutation.isPending || !checklistForm.employee_name.trim() || !checklistForm.start_date || !checklistForm.template_id}>
              {createChecklistMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-1" />}
              {ar ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
