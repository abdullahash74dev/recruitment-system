import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { useValueSynonyms, normText } from "@/hooks/useValueSynonyms";
import ApplyNormalizationDialog from "./ApplyNormalizationDialog";

type Row = { id: string; field_name: string; canonical_ar: string; canonical_en: string | null; synonyms: string[]; is_active: boolean };

const FIELD_OPTIONS = [
  { value: "education_level", label: "المستوى التعليمي", table: "applicants", column: "education_level" },
  { value: "nationality", label: "الجنسية", table: "applicants", column: "nationality" },
  { value: "city", label: "المدن (الحالية)", table: "applicants", column: "current_city" },
  { value: "preferred_city", label: "المدينة المفضلة", table: "applicants", column: "preferred_city" },
  { value: "desired_position", label: "المسمى الوظيفي", table: "applicants", column: "desired_position" },
  { value: "current_title", label: "المسمى الحالي", table: "applicants", column: "current_title" },
  { value: "major", label: "التخصص", table: "applicants", column: "major" },
  { value: "university", label: "الجامعة", table: "applicants", column: "university" },
  { value: "job_type", label: "نوع الدوام", table: "applicants", column: "job_type" },
  { value: "gender", label: "الجنس", table: "applicants", column: "gender" },
  { value: "marital_status", label: "الحالة الاجتماعية", table: "applicants", column: "marital_status" },
  { value: "years_experience", label: "سنوات الخبرة", table: "applicants", column: "years_experience" },
  { value: "current_salary", label: "الراتب الحالي", table: "applicants", column: "current_salary" },
  { value: "expected_salary", label: "الراتب المتوقع", table: "applicants", column: "expected_salary" },
  { value: "arabic_level", label: "مستوى العربية", table: "applicants", column: "arabic_level" },
  { value: "english_level", label: "مستوى الإنجليزية", table: "applicants", column: "english_level" },
  { value: "available_date", label: "تاريخ التوفر", table: "applicants", column: "available_date" },
  { value: "hear_about", label: "كيف سمعت عنا", table: "applicants", column: "hear_about" },
  { value: "has_transport", label: "وسيلة النقل", table: "applicants", column: "has_transport" },
  { value: "currently_employed", label: "يعمل حالياً", table: "applicants", column: "currently_employed" },
  { value: "currently_studying", label: "يدرس حالياً", table: "applicants", column: "currently_studying" },
];

export default function SynonymsManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [activeField, setActiveField] = useState(FIELD_OPTIONS[0].value);
  const [newAr, setNewAr] = useState("");
  const [newEn, setNewEn] = useState("");
  const [newSyn, setNewSyn] = useState("");

  // Live values from the data
  const [liveValues, setLiveValues] = useState<{ value: string; count: number }[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetRowId, setTargetRowId] = useState<string>("__new__");
  const { refresh: refreshSynCache } = useValueSynonyms();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("value_synonyms").select("*").order("field_name").order("canonical_ar");
    setRows((data || []) as Row[]);
    setLoading(false);
    refreshSynCache();
  };

  const loadLiveValues = async () => {
    const opt = FIELD_OPTIONS.find(f => f.value === activeField);
    if (!opt) return;
    setLiveLoading(true);
    const { data } = await supabase.from(opt.table as any).select(opt.column).limit(5000);
    const counts = new Map<string, number>();
    (data || []).forEach((r: any) => {
      const v = (r[opt.column] || "").toString().trim();
      if (!v) return;
      counts.set(v, (counts.get(v) || 0) + 1);
    });
    const arr = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
    setLiveValues(arr);
    setLiveLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadLiveValues(); setSelected(new Set()); setTargetRowId("__new__"); }, [activeField]);

  const filtered = rows.filter(r => r.field_name === activeField);

  // Values not yet covered by any synonym of any row for this field
  const unmatchedValues = useMemo(() => {
    if (filtered.length === 0) return liveValues;
    const covered = new Set<string>();
    filtered.forEach(r => {
      [r.canonical_ar, r.canonical_en || "", ...(r.synonyms || [])].forEach(s => {
        const n = normText(s);
        if (n) covered.add(n);
      });
    });
    return liveValues.filter(({ value }) => {
      const n = normText(value);
      if (covered.has(n)) return false;
      // Also exclude substring matches against existing synonyms (length >= 3)
      for (const r of filtered) {
        const all = [r.canonical_ar, r.canonical_en || "", ...(r.synonyms || [])]
          .map(normText).filter(s => s.length >= 3);
        if (all.some(s => n.includes(s) || s.includes(n))) return false;
      }
      return true;
    });
  }, [filtered, liveValues]);

  const toggleSelect = (v: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  const addSelectedToTarget = async () => {
    if (selected.size === 0) return toast.error("اختر قيمة واحدة على الأقل");
    const values = Array.from(selected);

    if (targetRowId === "__new__") {
      // Fill the new row form with first selected as canonical and the rest as synonyms
      setNewAr(values[0]);
      setNewSyn(values.slice(1).join(", "));
      toast.info("تم تعبئة النموذج، أضف الترجمة الإنجليزية ثم اضغط +");
      return;
    }

    const target = rows.find(r => r.id === targetRowId);
    if (!target) return;
    const existing = new Set((target.synonyms || []).map(s => s.trim()).filter(Boolean));
    values.forEach(v => existing.add(v.trim()));
    const { error } = await supabase
      .from("value_synonyms")
      .update({ synonyms: Array.from(existing) })
      .eq("id", target.id);
    if (error) return toast.error(error.message);
    toast.success(`تمت إضافة ${values.length} قيمة إلى "${target.canonical_ar}"`);
    setSelected(new Set());
    load();
  };

  const addRow = async () => {
    if (!newAr.trim()) return;
    const synonyms = newSyn.split(",").map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.from("value_synonyms").insert({
      field_name: activeField, canonical_ar: newAr.trim(), canonical_en: newEn.trim() || null, synonyms,
    });
    if (error) return toast.error(error.message);
    setNewAr(""); setNewEn(""); setNewSyn(""); setSelected(new Set());
    toast.success("تمت الإضافة");
    load();
  };

  const removeRow = async (id: string) => {
    if (!confirm("حذف هذا المرادف؟")) return;
    const { error } = await supabase.from("value_synonyms").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const updateSyns = async (id: string, syns: string) => {
    const synonyms = syns.split(",").map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.from("value_synonyms").update({ synonyms }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const aiSuggest = async () => {
    const opt = FIELD_OPTIONS.find(f => f.value === activeField);
    if (!opt) return;
    setAiBusy(true);
    const { data, error } = await supabase.functions.invoke("ai-suggest-synonyms", {
      body: { field_name: activeField, source_table: opt.table, source_column: opt.column, autosave: true },
    });
    setAiBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`تم اقتراح وحفظ ${data?.groups?.length || 0} مجموعة`);
    load();
  };

  const [applyOpen, setApplyOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span>توحيد القيم ثنائي اللغة (Synonyms)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={aiSuggest} disabled={aiBusy}>
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span className="ms-2">اقتراح بالذكاء الاصطناعي</span>
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setApplyOpen(true)} disabled={filtered.length === 0} className="gap-1">
              <ShieldAlert className="h-4 w-4" />
              تطبيق على بيانات «{FIELD_OPTIONS.find(f => f.value === activeField)?.label}»
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <ApplyNormalizationDialog open={applyOpen} onOpenChange={setApplyOpen} fieldNames={[activeField]} />
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div>
            <Label>الحقل</Label>
            <Select value={activeField} onValueChange={setActiveField}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FIELD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>عربي (قانوني)</Label><Input value={newAr} onChange={e => setNewAr(e.target.value)} placeholder="بكالوريوس" /></div>
          <div><Label>إنجليزي (قانوني)</Label><Input value={newEn} onChange={e => setNewEn(e.target.value)} placeholder="Bachelor" /></div>
          <div className="flex items-end gap-2">
            <Input value={newSyn} onChange={e => setNewSyn(e.target.value)} placeholder="bsc, b.sc, bachelors" />
            <Button onClick={addRow}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Live values picker */}
        <div className="border rounded-md p-3 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm font-medium">
              قيم موجودة في النظام غير موحَّدة
              <span className="text-muted-foreground ms-2">({unmatchedValues.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={loadLiveValues} disabled={liveLoading}>
                {liveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
              <Select value={targetRowId} onValueChange={setTargetRowId}>
                <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">— إنشاء قيمة جديدة —</SelectItem>
                  {filtered.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.canonical_ar} ({r.canonical_en || "—"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addSelectedToTarget} disabled={selected.size === 0}>
                إضافة المحدد ({selected.size})
              </Button>
            </div>
          </div>
          {liveLoading ? (
            <div className="text-xs text-muted-foreground text-center py-2">جارٍ التحميل...</div>
          ) : unmatchedValues.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-2">كل القيم موحَّدة ✓</div>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {unmatchedValues.slice(0, 200).map(({ value, count }) => {
                const isSel = selected.has(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleSelect(value)}
                    className={`text-xs px-2 py-1 rounded-md border transition ${
                      isSel
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent border-border"
                    }`}
                  >
                    {value} <span className="opacity-60">×{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {loading ? <div className="text-center py-6 text-muted-foreground">جاري التحميل...</div> : (
          <div className="space-y-2">
            {filtered.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">لا توجد قيم بعد لهذا الحقل.</div>}
            {filtered.map(r => (
              <div key={r.id} className="flex items-center gap-2 p-3 border rounded-md flex-wrap">
                <Badge variant="secondary">{r.canonical_ar}</Badge>
                <Badge variant="outline">{r.canonical_en || "—"}</Badge>
                <Input
                  className="flex-1 min-w-[200px]"
                  defaultValue={(r.synonyms || []).join(", ")}
                  onBlur={(e) => updateSyns(r.id, e.target.value)}
                  placeholder="مرادفات بفاصلة"
                />
                <Button size="icon" variant="ghost" onClick={() => removeRow(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
