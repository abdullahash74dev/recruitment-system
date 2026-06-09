import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical, Settings } from "lucide-react";
import { useDeletePin } from "@/components/DeletePinDialog";

interface CustomQuestion {
  id: string;
  question_ar: string;
  question_en: string | null;
  type: string;
  options_ar: string[];
  options_en: string[];
  is_required: boolean;
  step_number: number;
  sort_order: number;
  is_active: boolean;
}

const STEP_LABELS_AR = ["البيانات الأساسية", "التفضيلات الوظيفية", "المؤهل العلمي", "الخبرات والمهارات", "التوقعات المالية", "المرفقات"];
const STEP_LABELS_EN = ["Basic Info", "Job Preferences", "Education", "Experience & Skills", "Financial", "Attachments"];

const CustomQuestionsSettings = () => {
  const { t, lang, dir } = useLanguage();
  const { requestDelete } = useDeletePin();
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomQuestion | null>(null);
  const [form, setForm] = useState({
    question_ar: "",
    question_en: "",
    type: "text",
    options_ar: "",
    options_en: "",
    is_required: false,
    step_number: 4,
    sort_order: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    const { data } = await supabase
      .from("custom_questions")
      .select("*")
      .order("step_number", { ascending: true })
      .order("sort_order", { ascending: true });
    if (data) setQuestions(data as CustomQuestion[]);
  };

  const openForm = (q?: CustomQuestion) => {
    if (q) {
      setEditing(q);
      setForm({
        question_ar: q.question_ar,
        question_en: q.question_en || "",
        type: q.type,
        options_ar: (q.options_ar || []).join("، "),
        options_en: (q.options_en || []).join(", "),
        is_required: q.is_required,
        step_number: q.step_number,
        sort_order: q.sort_order,
        is_active: q.is_active,
      });
    } else {
      setEditing(null);
      setForm({
        question_ar: "",
        question_en: "",
        type: "text",
        options_ar: "",
        options_en: "",
        is_required: false,
        step_number: 4,
        sort_order: questions.length,
        is_active: true,
      });
    }
    setShowForm(true);
  };

  const parseOptions = (str: string): string[] => {
    if (!str.trim()) return [];
    return str.split(/[,،]/).map(s => s.trim()).filter(Boolean);
  };

  const saveQuestion = async () => {
    if (!form.question_ar) {
      toast.error(t("validation.required"));
      return;
    }

    const payload = {
      question_ar: form.question_ar,
      question_en: form.question_en || null,
      type: form.type,
      options_ar: parseOptions(form.options_ar),
      options_en: parseOptions(form.options_en),
      is_required: form.is_required,
      step_number: form.step_number,
      sort_order: form.sort_order,
      is_active: form.is_active,
    };

    if (editing) {
      const { error } = await supabase.from("custom_questions").update(payload).eq("id", editing.id);
      if (!error) {
        toast.success(t("dash.saved"));
        fetchQuestions();
        setShowForm(false);
      }
    } else {
      const { error } = await supabase.from("custom_questions").insert(payload);
      if (!error) {
        toast.success(t("dash.saved"));
        fetchQuestions();
        setShowForm(false);
      }
    }
  };

  const deleteQuestion = (id: string) => {
    requestDelete({
      message: lang === "ar" ? "سيتم حذف هذا السؤال نهائياً." : "This question will be permanently deleted.",
      onConfirm: async () => {
        const { error } = await supabase.from("custom_questions").delete().eq("id", id);
        if (!error) { toast.success(t("dash.deleted")); fetchQuestions(); }
        else toast.error(error.message);
      },
    });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("custom_questions").update({ is_active: active }).eq("id", id);
    fetchQuestions();
  };

  const stepLabels = lang === "ar" ? STEP_LABELS_AR : STEP_LABELS_EN;
  const typeLabels: Record<string, string> = {
    text: t("dash.questionType.text"),
    select: t("dash.questionType.select"),
    textarea: t("dash.questionType.textarea"),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          {t("dash.customQuestions")}
        </h3>
        <Button onClick={() => openForm()} className="gradient-accent text-accent-foreground gap-2">
          <Plus className="w-4 h-4" />
          {t("dash.addQuestion")}
        </Button>
      </div>

      {questions.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">{t("dash.noQuestions")}</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <Card key={q.id} className={`${!q.is_active ? "opacity-50" : ""}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {lang === "ar" ? q.question_ar : (q.question_en || q.question_ar)}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{stepLabels[q.step_number - 1]}</Badge>
                    <Badge variant="outline" className="text-xs">{typeLabels[q.type]}</Badge>
                    {q.is_required && <Badge className="text-xs bg-destructive/10 text-destructive border-0">{t("dash.questionRequired")}</Badge>}
                    {q.type === "select" && (
                      <span className="text-xs text-muted-foreground">
                        {(lang === "ar" ? q.options_ar : q.options_en)?.length || 0} {lang === "ar" ? "خيار" : "options"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={q.is_active} onCheckedChange={(v) => toggleActive(q.id, v)} />
                  <Button size="sm" variant="ghost" onClick={() => openForm(q)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteQuestion(q.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Question Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle>{editing ? t("dash.editQuestion") : t("dash.addQuestion")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("dash.questionAr")} *</Label>
              <Input value={form.question_ar} onChange={e => setForm(p => ({ ...p, question_ar: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t("dash.questionEn")}</Label>
              <Input value={form.question_en} onChange={e => setForm(p => ({ ...p, question_en: e.target.value }))} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("dash.questionType")}</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{t("dash.questionType.text")}</SelectItem>
                    <SelectItem value="select">{t("dash.questionType.select")}</SelectItem>
                    <SelectItem value="textarea">{t("dash.questionType.textarea")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("dash.questionStep")}</Label>
                <Select value={String(form.step_number)} onValueChange={v => setForm(p => ({ ...p, step_number: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stepLabels.map((label, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.type === "select" && (
              <>
                <div className="space-y-2">
                  <Label>{t("dash.optionsAr")}</Label>
                  <Input value={form.options_ar} onChange={e => setForm(p => ({ ...p, options_ar: e.target.value }))} placeholder="خيار 1، خيار 2، خيار 3" />
                </div>
                <div className="space-y-2">
                  <Label>{t("dash.optionsEn")}</Label>
                  <Input value={form.options_en} onChange={e => setForm(p => ({ ...p, options_en: e.target.value }))} dir="ltr" placeholder="Option 1, Option 2, Option 3" />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("dash.questionOrder")}</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.is_required} onCheckedChange={v => setForm(p => ({ ...p, is_required: v }))} />
                <Label>{t("dash.questionRequired")}</Label>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
              <Label>{form.is_active ? t("dash.jobActive") : t("dash.jobInactive")}</Label>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>{t("dash.cancel")}</Button>
              <Button onClick={saveQuestion} className="gradient-accent text-accent-foreground">{t("dash.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomQuestionsSettings;
