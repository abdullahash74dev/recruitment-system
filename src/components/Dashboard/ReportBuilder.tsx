import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Play, FileText, Trash2, Sparkles } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Scope = "applicants" | "recruitment" | "jobs";

const SCOPE_FIELDS: Record<Scope, { value: string; label: string }[]> = {
  applicants: [
    { value: "full_name", label: "الاسم" },
    { value: "email", label: "البريد" },
    { value: "phone", label: "الجوال" },
    { value: "nationality", label: "الجنسية" },
    { value: "current_city", label: "المدينة الحالية" },
    { value: "preferred_city", label: "المدينة المفضلة" },
    { value: "desired_position", label: "المسمى المرغوب" },
    { value: "education_level", label: "المستوى التعليمي" },
    { value: "major", label: "التخصص" },
    { value: "years_experience", label: "سنوات الخبرة" },
    { value: "status", label: "الحالة" },
    { value: "created_at", label: "تاريخ التقديم" },
  ],
  recruitment: [
    { value: "full_name", label: "الاسم" },
    { value: "nationality", label: "الجنسية" },
    { value: "status", label: "الحالة" },
    { value: "batch_label", label: "الدفعة" },
    { value: "hire_date", label: "تاريخ التوظيف" },
    { value: "created_at", label: "تاريخ الإضافة" },
  ],
  jobs: [
    { value: "title_ar", label: "المسمى" },
    { value: "location", label: "الموقع" },
    { value: "job_type", label: "نوع الدوام" },
    { value: "department", label: "القسم" },
    { value: "vacancy_count", label: "العدد المطلوب" },
    { value: "is_active", label: "نشطة" },
    { value: "created_at", label: "تاريخ النشر" },
  ],
};

interface Template {
  id: string;
  name: string;
  description: string | null;
  scope: Scope;
  config: any;
}

export default function ReportBuilder() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("تقرير جديد");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<Scope>("applicants");
  const [fields, setFields] = useState<string[]>(["full_name", "nationality", "status"]);
  const [groupBy, setGroupBy] = useState<string>("status");
  const [filterField, setFilterField] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [aiInsights, setAiInsights] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const loadTemplates = async () => {
    const { data } = await supabase.from("report_templates").select("*").order("created_at", { ascending: false });
    setTemplates((data || []) as Template[]);
  };
  useEffect(() => { loadTemplates(); }, []);

  const availableFields = SCOPE_FIELDS[scope];

  const toggleField = (f: string) => {
    setFields(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  };

  const buildConfig = () => {
    const filters: Record<string, any> = {};
    if (filterField && filterValue) filters[filterField] = filterValue;
    return { scope, fields, group_by: groupBy ? [groupBy] : [], filters, ai_insights: aiInsights, lang, name };
  };

  const runNow = async () => {
    if (!fields.length) return toast.error("اختر حقلاً واحداً على الأقل");
    setRunning(true);
    setLastResult(null);
    const { data, error } = await supabase.functions.invoke("run-recruitment-report", {
      body: { config: buildConfig() },
    });
    setRunning(false);
    if (error) return toast.error(error.message);
    if (data?.error) return toast.error(data.error);
    setLastResult(data);
    toast.success("تم إنشاء التقرير");
  };

  const saveTemplate = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("report_templates").insert({
      name, description: description || null, scope, config: buildConfig(), created_by: user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم حفظ القالب");
    loadTemplates();
  };

  const loadTemplate = (t: Template) => {
    setName(t.name);
    setDescription(t.description || "");
    setScope(t.scope);
    setFields(t.config?.fields || []);
    setGroupBy(t.config?.group_by?.[0] || "");
    setLang(t.config?.lang || "ar");
    setAiInsights(!!t.config?.ai_insights);
    const f = t.config?.filters ? Object.entries(t.config.filters)[0] : null;
    if (f) { setFilterField(String(f[0])); setFilterValue(String(f[1])); } else { setFilterField(""); setFilterValue(""); }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("حذف هذا القالب؟")) return;
    const { error } = await supabase.from("report_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadTemplates();
  };

  const exportPdf = () => {
    if (!lastResult) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(name, 14, 16);
    doc.setFontSize(10);
    doc.text(`Records: ${lastResult.row_count || 0}  |  Scope: ${scope}  |  ${new Date().toLocaleString()}`, 14, 24);
    autoTable(doc, {
      startY: 30,
      head: [["File", "URL"]],
      body: [[lastResult.file_name, lastResult.file_url || ""]],
      styles: { fontSize: 8 },
    });
    if (lastResult.insights) {
      const lines = doc.splitTextToSize(lastResult.insights, 270);
      doc.addPage();
      doc.setFontSize(14);
      doc.text("AI Insights", 14, 16);
      doc.setFontSize(10);
      doc.text(lines, 14, 26);
    }
    doc.save(`${name}.pdf`);
  };

  return (
    <div className="space-y-4">
      {templates.length > 0 && (
        <Card>
          <CardHeader><CardTitle>القوالب المحفوظة</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-2 border rounded-md px-3 py-2">
                <button className="text-sm font-medium hover:underline" onClick={() => loadTemplate(t)}>{t.name}</button>
                <Badge variant="outline">{t.scope}</Badge>
                <Button size="icon" variant="ghost" onClick={() => deleteTemplate(t.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> باني التقارير المخصص</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>اسم التقرير</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div>
              <Label>النطاق</Label>
              <Select value={scope} onValueChange={(v) => { setScope(v as Scope); setFields([]); setGroupBy(""); setFilterField(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="applicants">المتقدمون</SelectItem>
                  <SelectItem value="recruitment">مرشحو التوظيف</SelectItem>
                  <SelectItem value="jobs">الوظائف المنشورة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>الوصف (اختياري)</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
          </div>

          <div>
            <Label className="mb-2 block">الحقول المعروضة</Label>
            <div className="flex flex-wrap gap-2">
              {availableFields.map(f => (
                <Badge
                  key={f.value}
                  variant={fields.includes(f.value) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleField(f.value)}
                >{f.label}</Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>تجميع حسب</Label>
              <Select value={groupBy || "__none"} onValueChange={(v) => setGroupBy(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="لا شيء" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— لا شيء —</SelectItem>
                  {availableFields.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>فلتر — الحقل</Label>
              <Select value={filterField || "__none"} onValueChange={(v) => setFilterField(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="بدون فلتر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— بدون —</SelectItem>
                  {availableFields.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>قيمة الفلتر</Label><Input value={filterValue} onChange={e => setFilterValue(e.target.value)} placeholder="مثال: new" /></div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={aiInsights} onCheckedChange={setAiInsights} id="ai" />
              <Label htmlFor="ai" className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> تحليل AI</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label>لغة العرض</Label>
              <Select value={lang} onValueChange={(v) => setLang(v as any)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={runNow} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              <span className="ms-2">تشغيل الآن</span>
            </Button>
            <Button variant="outline" onClick={saveTemplate} disabled={saving}>
              <Save className="h-4 w-4" /><span className="ms-2">حفظ كقالب</span>
            </Button>
            {lastResult?.file_url && (
              <>
                <Button variant="secondary" asChild>
                  <a href={lastResult.file_url} target="_blank" rel="noreferrer">تحميل Excel</a>
                </Button>
                <Button variant="secondary" onClick={exportPdf}>تحميل PDF</Button>
              </>
            )}
          </div>

          {lastResult?.insights && (
            <div className="border rounded-md p-3 bg-muted/30 text-sm whitespace-pre-wrap">
              <div className="font-semibold mb-2 flex items-center gap-1"><Sparkles className="h-3 w-3" /> ملخص تحليلي</div>
              {lastResult.insights}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
