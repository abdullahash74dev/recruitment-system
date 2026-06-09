import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sparkles, SlidersHorizontal, X, Loader2, TrendingUp, Users, MapPin, GraduationCap, Briefcase, Download, FileArchive, ChevronDown, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import AiFilterBuilder from "./AiFilterBuilder";

type AiMatch = { id: string; score: number; reason: string };
type AiStats = { by_nationality: { key: string; count: number }[]; by_education: { key: string; count: number }[]; by_city: { key: string; count: number }[]; by_position: { key: string; count: number }[] };
type AiResult = { matched: AiMatch[]; total_scanned: number; total_matched: number; stats: AiStats; warnings?: string[] };

// Filterable fields on the applicant record
const FILTER_FIELDS = [
  { key: "nationality", ar: "الجنسية", en: "Nationality" },
  { key: "desired_position", ar: "المسمى الوظيفي", en: "Desired Position" },
  { key: "preferred_city", ar: "المدينة المفضلة", en: "Preferred City" },
  { key: "current_city", ar: "المدينة الحالية", en: "Current City" },
  { key: "gender", ar: "الجنس", en: "Gender" },
  { key: "marital_status", ar: "الحالة الاجتماعية", en: "Marital Status" },
  { key: "education_level", ar: "المؤهل العلمي", en: "Education" },
  { key: "major", ar: "التخصص", en: "Major" },
  { key: "university", ar: "الجامعة", en: "University" },
  { key: "job_type", ar: "نوع الوظيفة", en: "Job Type" },
  { key: "years_experience", ar: "سنوات الخبرة", en: "Years Experience" },
  { key: "current_title", ar: "المسمى الحالي", en: "Current Title" },
  { key: "currently_employed", ar: "موظف حالياً", en: "Currently Employed" },
  { key: "has_transport", ar: "وسيلة نقل", en: "Has Transport" },
  { key: "arabic_level", ar: "اللغة العربية", en: "Arabic Level" },
  { key: "english_level", ar: "اللغة الإنجليزية", en: "English Level" },
  { key: "hear_about", ar: "كيف سمع عنا", en: "Heard About Us" },
  { key: "source", ar: "المصدر (direct/external)", en: "Source (direct/external)" },
  { key: "source_company", ar: "اسم الشركة المصدر", en: "Source Company" },
] as const;

export type AdvancedFilter = { field: string; value: string };

interface Props {
  applicants: any[];
  lang: "ar" | "en";
  filters: AdvancedFilter[];
  setFilters: (f: AdvancedFilter[]) => void;
  aiSelectedIds: Set<string> | null;
  setAiSelectedIds: (s: Set<string> | null) => void;
  aiSummary: string;
  setAiSummary: (s: string) => void;
}

export default function ApplicantsAdvancedFilters({
  applicants, lang, filters, setFilters,
  aiSelectedIds, setAiSelectedIds, aiSummary, setAiSummary,
}: Props) {
  const [newField, setNewField] = useState<string>("nationality");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [valueSearch, setValueSearch] = useState("");
  const [valuePopoverOpen, setValuePopoverOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const applicantById = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of applicants) m.set(a.id, a);
    return m;
  }, [applicants]);

  // Distinct values per field (from existing data) with counts
  const distinctValues = useMemo(() => {
    const counts = new Map<string, number>();
    applicants.forEach((a) => {
      const v = a[newField];
      if (v != null && String(v).trim() !== "") {
        const key = String(v).trim();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
  }, [applicants, newField]);

  const filteredDistinct = useMemo(() => {
    const q = valueSearch.trim().toLowerCase();
    if (!q) return distinctValues;
    return distinctValues.filter((d) => d.value.toLowerCase().includes(q));
  }, [distinctValues, valueSearch]);

  const togglePicked = (v: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  const addFilter = () => {
    if (picked.size === 0) return;
    // Avoid duplicates: only add (field,value) pairs not already present
    const existing = new Set(filters.filter((f) => f.field === newField).map((f) => f.value));
    const additions: AdvancedFilter[] = [];
    picked.forEach((v) => { if (!existing.has(v)) additions.push({ field: newField, value: v }); });
    if (additions.length === 0) {
      toast.info(lang === "ar" ? "كل القيم المختارة مضافة مسبقاً" : "Selected values already added");
    } else {
      setFilters([...filters, ...additions]);
      toast.success(lang === "ar" ? `أُضيف ${additions.length} فلتر` : `Added ${additions.length} filters`);
    }
    setPicked(new Set());
    setValueSearch("");
    setValuePopoverOpen(false);
  };

  const removeFilter = (i: number) => {
    setFilters(filters.filter((_, idx) => idx !== i));
  };

  const clearAll = () => {
    setFilters([]);
    setAiSelectedIds(null);
    setAiSummary("");
    setAiResult(null);
    setAiPrompt("");
  };

  const runAi = async () => {
    if (!aiPrompt.trim()) {
      toast.error(lang === "ar" ? "اكتب وصف ما تريد البحث عنه" : "Describe what to find");
      return;
    }
    setAiLoading(true);
    try {
      // Send only the fields needed (keep payload small)
      const slim = applicants.map((a) => ({
        id: a.id,
        full_name: a.full_name,
        nationality: a.nationality,
        desired_position: a.desired_position,
        preferred_city: a.preferred_city,
        current_city: a.current_city,
        gender: a.gender,
        education_level: a.education_level,
        major: a.major,
        university: a.university,
        years_experience: a.years_experience,
        current_title: a.current_title,
        currently_employed: a.currently_employed,
        arabic_level: a.arabic_level,
        english_level: a.english_level,
        job_type: a.job_type,
        marital_status: a.marital_status,
        has_transport: a.has_transport,
        current_salary: a.current_salary,
        expected_salary: a.expected_salary,
        self_summary: a.self_summary,
        current_tasks: a.current_tasks,
        other_experience: a.other_experience,
        status: a.status,
      }));
      const { data, error } = await supabase.functions.invoke("filter-applicants-ai", {
        body: { prompt: aiPrompt, applicants: slim, lang },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const ids: string[] = Array.isArray(data?.matched_ids) ? data.matched_ids : [];
      setAiSelectedIds(new Set(ids));
      setAiResult({
        matched: Array.isArray(data?.matched) ? data.matched : [],
        total_scanned: data?.total_scanned || 0,
        total_matched: data?.total_matched || ids.length,
        stats: data?.stats || { by_nationality: [], by_education: [], by_city: [], by_position: [] },
        warnings: data?.warnings || [],
      });
      setAiSummary(""); // legacy
      toast.success(lang === "ar" ? `تم العثور على ${ids.length} مرشح` : `Found ${ids.length} matches`);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("429")) toast.error(lang === "ar" ? "تم تجاوز الحد، حاول لاحقاً" : "Rate limited, try later");
      else if (msg.includes("402")) toast.error(lang === "ar" ? "نفدت الأرصدة" : "Credits exhausted");
      else toast.error(lang === "ar" ? `خطأ: ${msg}` : `Error: ${msg}`);
    } finally {
      setAiLoading(false);
    }
  };

  const fieldLabel = (k: string) => {
    const f = FILTER_FIELDS.find((x) => x.key === k);
    return f ? (lang === "ar" ? f.ar : f.en) : k;
  };

  // Build a comprehensive row with ALL applicant fields the user submitted
  const buildExportRow = (a: any, ai?: { score: number; reason: string }) => {
    const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
    const row: any = {
      [L("الاسم الكامل", "Full Name")]: a.full_name,
      [L("البريد", "Email")]: a.email,
      [L("الجوال", "Phone")]: a.phone,
      [L("الجنسية", "Nationality")]: a.nationality,
      [L("الجنس", "Gender")]: a.gender,
      [L("تاريخ الميلاد", "Birth Date")]: a.birth_date,
      [L("الحالة الاجتماعية", "Marital Status")]: a.marital_status,
      [L("عدد المعالين", "Dependents")]: a.dependents,
      [L("المدينة الحالية", "Current City")]: a.current_city,
      [L("المدينة المفضلة", "Preferred City")]: a.preferred_city,
      [L("وسيلة نقل", "Has Transport")]: a.has_transport,
      [L("المسمى المطلوب", "Desired Position")]: a.desired_position,
      [L("نوع الوظيفة", "Job Type")]: a.job_type,
      [L("المؤهل العلمي", "Education")]: a.education_level,
      [L("التخصص", "Major")]: a.major,
      [L("الجامعة", "University")]: a.university,
      [L("سنة التخرج", "Graduation Year")]: a.graduation_year,
      [L("المعدل", "GPA")]: a.gpa,
      [L("يدرس حالياً", "Currently Studying")]: a.currently_studying,
      [L("الدراسة الحالية", "Current Study")]: a.current_study,
      [L("سنوات الخبرة", "Years Experience")]: a.years_experience,
      [L("موظف حالياً", "Currently Employed")]: a.currently_employed,
      [L("المسمى الحالي", "Current Title")]: a.current_title,
      [L("المهام الحالية", "Current Tasks")]: a.current_tasks,
      [L("ملخص ذاتي", "Self Summary")]: a.self_summary,
      [L("خبرات أخرى", "Other Experience")]: a.other_experience,
      [L("خبرة إدارة المرافق", "Facility Mgmt Exp")]: a.facility_management_exp,
      [L("العربية", "Arabic")]: a.arabic_level,
      [L("الإنجليزية", "English")]: a.english_level,
      [L("لغة أخرى", "Other Language")]: a.other_language,
      [L("لينكدإن", "LinkedIn")]: a.linkedin,
      [L("الراتب الحالي", "Current Salary")]: a.current_salary,
      [L("الراتب المتوقع", "Expected Salary")]: a.expected_salary,
      [L("تاريخ التوفر", "Available Date")]: a.available_date,
      [L("كيف سمع عنا", "Heard About Us")]: a.hear_about,
      [L("المصدر", "Source")]: a.source,
      [L("شركة المصدر", "Source Company")]: a.source_company,
      [L("الحالة", "Status")]: a.status,
      [L("ملاحظات", "Notes")]: a.notes,
      [L("تاريخ التقديم", "Submitted At")]: a.created_at,
      [L("ملف السيرة الذاتية", "Resume File")]: a.resume_url ? "✓" : "",
      [L("ملف الشهادة", "Degree File")]: a.degree_url ? "✓" : "",
      [L("شهادة خبرة", "Experience Cert")]: a.experience_cert_url ? "✓" : "",
      [L("شهادات تدريب", "Training Certs")]: a.training_certs_url ? "✓" : "",
      [L("مستندات أخرى", "Other Docs")]: a.other_docs_url ? "✓" : "",
    };
    if (ai) {
      row[L("نسبة المطابقة", "AI Score")] = ai.score;
      row[L("سبب المطابقة", "AI Reason")] = ai.reason;
    }
    return row;
  };

  const exportFiltered = (format: "xlsx" | "csv") => {
    const filtered = applyAdvancedFilters(applicants, filters, aiSelectedIds);
    if (filtered.length === 0) {
      toast.error(lang === "ar" ? "لا توجد نتائج للتصدير" : "No results to export");
      return;
    }
    const scoreMap = new Map<string, { score: number; reason: string }>();
    aiResult?.matched.forEach((m) => scoreMap.set(m.id, { score: m.score, reason: m.reason }));
    const rows = filtered.map((a) => buildExportRow(a, scoreMap.get(a.id)));

    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    if (format === "csv") {
      const ws = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `filtered-applicants-${ts}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, lang === "ar" ? "النتائج" : "Results");
      XLSX.writeFile(wb, `filtered-applicants-${ts}.xlsx`);
    }
    toast.success(lang === "ar" ? `تم تصدير ${rows.length} نتيجة` : `Exported ${rows.length} results`);
  };

  const [zipLoading, setZipLoading] = useState(false);

  // Sanitize a filename component
  const safeName = (s: string) => String(s || "applicant").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);

  // Fetch a file as Blob from a storage path / data URI / URL
  const fetchAsBlob = async (path: string | null): Promise<Blob | null> => {
    if (!path) return null;
    try {
      if (path.startsWith("data:")) {
        const res = await fetch(path); return await res.blob();
      }
      if (path.startsWith("http")) {
        const res = await fetch(path); if (!res.ok) return null; return await res.blob();
      }
      // Private storage path inside resumes bucket
      const { data, error } = await supabase.storage.from("resumes").createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) return null;
      const res = await fetch(data.signedUrl);
      if (!res.ok) return null;
      return await res.blob();
    } catch { return null; }
  };

  const extFromBlob = (b: Blob, fallback = "pdf") => {
    const m = b.type.split("/")[1];
    if (!m) return fallback;
    if (m.includes("pdf")) return "pdf";
    if (m.includes("png")) return "png";
    if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
    if (m.includes("word") || m.includes("officedocument.word")) return "docx";
    return m.split(";")[0].split("+")[0] || fallback;
  };

  const exportZipWithFiles = async () => {
    const filtered = applyAdvancedFilters(applicants, filters, aiSelectedIds);
    if (filtered.length === 0) {
      toast.error(lang === "ar" ? "لا توجد نتائج للتصدير" : "No results to export");
      return;
    }
    setZipLoading(true);
    const tId = toast.loading(lang === "ar" ? `جاري تجهيز ${filtered.length} ملف...` : `Preparing ${filtered.length} files...`);
    try {
      const zip = new JSZip();
      const scoreMap = new Map<string, { score: number; reason: string }>();
      aiResult?.matched.forEach((m) => scoreMap.set(m.id, { score: m.score, reason: m.reason }));

      // 1) Master Excel of all data
      const rows = filtered.map((a) => buildExportRow(a, scoreMap.get(a.id)));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, lang === "ar" ? "النتائج" : "Results");
      const xlsxBuf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      zip.file("00_All_Applicants.xlsx", xlsxBuf);

      // 2) Per-applicant folder with attachments
      const fileFields: { key: string; label: string }[] = [
        { key: "resume_url", label: "Resume" },
        { key: "degree_url", label: "Degree" },
        { key: "experience_cert_url", label: "Experience_Cert" },
        { key: "training_certs_url", label: "Training_Certs" },
        { key: "other_docs_url", label: "Other_Docs" },
      ];

      let okCount = 0, failCount = 0;
      const CONCURRENCY = 4;
      let idx = 0;
      const worker = async () => {
        while (idx < filtered.length) {
          const i = idx++;
          const a = filtered[i];
          const folder = zip.folder(`${String(i + 1).padStart(3, "0")}_${safeName(a.full_name)}`);
          if (!folder) continue;
          // applicant_info.txt summary
          const info = Object.entries(buildExportRow(a, scoreMap.get(a.id)))
            .map(([k, v]) => `${k}: ${v ?? ""}`).join("\n");
          folder.file("applicant_info.txt", info);
          // attachments
          for (const ff of fileFields) {
            const blob = await fetchAsBlob(a[ff.key]);
            if (blob) {
              folder.file(`${ff.label}.${extFromBlob(blob)}`, blob);
              okCount++;
            } else if (a[ff.key]) {
              failCount++;
            }
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));

      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url; a.download = `applicants-with-files-${ts}.zip`; a.click();
      URL.revokeObjectURL(url);
      toast.dismiss(tId);
      toast.success(lang === "ar"
        ? `تم تصدير ${filtered.length} متقدم مع ${okCount} ملف${failCount ? ` (${failCount} تعذر تحميله)` : ""}`
        : `Exported ${filtered.length} applicants with ${okCount} files${failCount ? ` (${failCount} failed)` : ""}`);
    } catch (e: any) {
      toast.dismiss(tId);
      toast.error(lang === "ar" ? `فشل التصدير: ${e?.message || e}` : `Export failed: ${e?.message || e}`);
    } finally {
      setZipLoading(false);
    }
  };

  const hasResults = filters.length > 0 || aiSelectedIds;


  return (
    <Card className="mb-3">
      <CardContent className="p-3 space-y-3">
        {/* Field filter row */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[150px]">
            <Label className="text-xs">{lang === "ar" ? "الحقل" : "Field"}</Label>
            <Select value={newField} onValueChange={(v) => { setNewField(v); setPicked(new Set()); setValueSearch(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {FILTER_FIELDS.map((f) => (
                  <SelectItem key={f.key} value={f.key}>{lang === "ar" ? f.ar : f.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">
              {lang === "ar"
                ? `القيم (${distinctValues.length} موجودة في البيانات)`
                : `Values (${distinctValues.length} in data)`}
            </Label>
            <Popover open={valuePopoverOpen} onOpenChange={setValuePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal h-10">
                  <span className="truncate">
                    {picked.size === 0
                      ? (lang === "ar" ? "اختر قيمة أو أكثر..." : "Pick one or more...")
                      : (lang === "ar" ? `${picked.size} قيمة مختارة` : `${picked.size} selected`)}
                  </span>
                  <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0" align="start">
                <div className="p-2 border-b space-y-2">
                  <Input
                    autoFocus
                    placeholder={lang === "ar" ? "بحث..." : "Search..."}
                    value={valueSearch}
                    onChange={(e) => setValueSearch(e.target.value)}
                    className="h-8"
                  />
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      className="text-accent hover:underline"
                      onClick={() => setPicked(new Set(filteredDistinct.map((d) => d.value)))}
                    >
                      {lang === "ar" ? "تحديد الكل المعروض" : "Select all shown"}
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:underline"
                      onClick={() => setPicked(new Set())}
                    >
                      {lang === "ar" ? "مسح" : "Clear"}
                    </button>
                  </div>
                </div>
                <ScrollArea className="max-h-[280px]">
                  <div className="p-1">
                    {filteredDistinct.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-6">
                        {lang === "ar" ? "لا توجد قيم" : "No values"}
                      </div>
                    ) : (
                      filteredDistinct.map((d) => {
                        const checked = picked.has(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => togglePicked(d.value)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-start text-sm"
                          >
                            <Checkbox checked={checked} className="pointer-events-none" />
                            <span className="flex-1 truncate">{d.value}</span>
                            <Badge variant="secondary" className="text-[10px] h-5">{d.count}</Badge>
                            {checked && <Check className="w-3.5 h-3.5 text-accent" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
                <div className="p-2 border-t flex justify-end">
                  <Button size="sm" onClick={addFilter} disabled={picked.size === 0} className="gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    {lang === "ar" ? `إضافة (${picked.size})` : `Add (${picked.size})`}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={addFilter} variant="secondary" className="gap-1" disabled={picked.size === 0}>
            <SlidersHorizontal className="w-4 h-4" />{lang === "ar" ? "إضافة فلتر" : "Add Filter"}
          </Button>

          <AiFilterBuilder applicants={applicants} lang={lang} onApply={setFilters} currentFilters={filters} />


          {/* AI Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="default" className="gap-1 gradient-accent text-accent-foreground">
                <Sparkles className="w-4 h-4" />{lang === "ar" ? "فلترة بالذكاء الاصطناعي" : "AI Filter"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] max-w-[95vw] p-0" align="end">
              <div className="p-3 space-y-2 border-b">
                <Label className="text-sm font-semibold">{lang === "ar" ? "صف ما تبحث عنه" : "Describe what you want"}</Label>
                <Textarea
                  rows={3}
                  placeholder={lang === "ar" ? "مثال: مهندسون سعوديون في الرياض لديهم خبرة 5+ سنوات في تبريد وتكييف" : "e.g. Saudi engineers in Riyadh with 5+ years in HVAC"}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button onClick={runAi} disabled={aiLoading} className="flex-1 gap-1">
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {lang === "ar" ? "تحليل ذكي" : "Analyze"}
                  </Button>
                  {(aiSelectedIds || aiResult) && (
                    <Button variant="outline" onClick={() => { setAiSelectedIds(null); setAiResult(null); setAiSummary(""); }}>
                      {lang === "ar" ? "مسح" : "Clear"}
                    </Button>
                  )}
                </div>
              </div>

              {aiResult && (
                <ScrollArea className="max-h-[60vh]">
                  <div className="p-3 space-y-3">
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border bg-card p-2.5">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{lang === "ar" ? "مطابقون" : "Matched"}</div>
                        <div className="text-xl font-bold text-accent">{aiResult.total_matched}</div>
                      </div>
                      <div className="rounded-lg border bg-card p-2.5">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{lang === "ar" ? "تم فحصهم" : "Scanned"}</div>
                        <div className="text-xl font-bold">{aiResult.total_scanned}</div>
                      </div>
                    </div>

                    {/* Stats breakdown */}
                    {(["by_nationality", "by_education", "by_city", "by_position"] as const).map((k) => {
                      const arr = aiResult.stats?.[k] || [];
                      if (arr.length === 0) return null;
                      const labels: Record<string, { ar: string; en: string; icon: any }> = {
                        by_nationality: { ar: "الجنسية", en: "Nationality", icon: Users },
                        by_education: { ar: "المؤهل", en: "Education", icon: GraduationCap },
                        by_city: { ar: "المدينة", en: "City", icon: MapPin },
                        by_position: { ar: "الوظيفة", en: "Position", icon: Briefcase },
                      };
                      const L = labels[k];
                      const Icon = L.icon;
                      return (
                        <div key={k} className="rounded-lg border bg-muted/30 p-2.5">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Icon className="w-3.5 h-3.5 text-accent" />
                            <span className="text-xs font-semibold">{lang === "ar" ? L.ar : L.en}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {arr.map((s) => (
                              <Badge key={s.key} variant="secondary" className="text-[10px] font-normal">
                                {s.key} <span className="ms-1 font-bold text-accent">{s.count}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Top candidates with reasons */}
                    {aiResult.matched.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <TrendingUp className="w-3.5 h-3.5 text-accent" />
                          {lang === "ar" ? "أفضل المرشحين" : "Top matches"}
                        </div>
                        {aiResult.matched.slice(0, 10).map((m) => {
                          const a = applicantById.get(m.id);
                          if (!a) return null;
                          return (
                            <div key={m.id} className="rounded-md border bg-card p-2 text-xs">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className="font-semibold truncate">{a.full_name}</span>
                                <Badge className="text-[10px] h-5 shrink-0" variant={m.score >= 80 ? "default" : "secondary"}>{m.score}%</Badge>
                              </div>
                              <div className="text-muted-foreground text-[11px] leading-snug">{m.reason}</div>
                              {(a.desired_position || a.nationality) && (
                                <div className="text-[10px] text-muted-foreground mt-1 flex gap-2">
                                  {a.desired_position && <span>· {a.desired_position}</span>}
                                  {a.nationality && <span>· {a.nationality}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {aiResult.warnings && aiResult.warnings.length > 0 && (
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 border-t pt-2">
                        {aiResult.warnings.some((w) => String(w).includes("local_filter"))
                          ? (lang === "ar" ? "تم تشغيل التحليل المحلي الاحتياطي بنجاح." : "Local fallback analysis ran successfully.")
                          : `${lang === "ar" ? "تنبيه:" : "Notice:"} ${aiResult.warnings.length} ${lang === "ar" ? "دفعة فشلت ولم تُضمَّن" : "chunks skipped"}`}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </PopoverContent>
          </Popover>

          {hasResults && (
            <>
              <Button variant="outline" onClick={() => exportFiltered("xlsx")} className="gap-1" title={lang === "ar" ? "تصدير Excel" : "Export Excel"}>
                <Download className="w-4 h-4" />XLSX
              </Button>
              <Button variant="outline" onClick={() => exportFiltered("csv")} className="gap-1" title={lang === "ar" ? "تصدير CSV" : "Export CSV"}>
                <Download className="w-4 h-4" />CSV
              </Button>
              <Button variant="default" onClick={exportZipWithFiles} disabled={zipLoading} className="gap-1 gradient-accent text-accent-foreground" title={lang === "ar" ? "تصدير ZIP يشمل السيرة الذاتية وجميع المرفقات" : "Export ZIP with CV & attachments"}>
                {zipLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
                {lang === "ar" ? "ZIP + السير الذاتية" : "ZIP + CVs"}
              </Button>
              <Button variant="ghost" onClick={clearAll} className="gap-1"><X className="w-4 h-4" />{lang === "ar" ? "مسح الكل" : "Clear all"}</Button>
            </>
          )}
        </div>

        {/* Active filters */}
        {(filters.length > 0 || aiSelectedIds) && (
          <div className="flex flex-wrap gap-2 pt-1 border-t">
            {filters.map((f, i) => (
              <Badge key={i} variant="secondary" className="gap-1 pe-1">
                <span>{fieldLabel(f.field)}: {f.value}</span>
                <button onClick={() => removeFilter(i)} className="hover:bg-destructive/20 rounded p-0.5"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
            {aiSelectedIds && (
              <Badge className="gap-1 gradient-accent text-accent-foreground">
                <Sparkles className="w-3 h-3" />
                {lang === "ar" ? `الذكاء الاصطناعي: ${aiSelectedIds.size} نتيجة` : `AI: ${aiSelectedIds.size} matches`}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function applyAdvancedFilters<T extends Record<string, any>>(
  items: T[],
  filters: AdvancedFilter[],
  aiSelectedIds: Set<string> | null,
): T[] {
  let out = items;
  if (filters.length) {
    // Group values by field — OR within same field, AND across fields
    const byField = new Map<string, string[]>();
    filters.forEach((f) => {
      const arr = byField.get(f.field) || [];
      arr.push(f.value.toLowerCase());
      byField.set(f.field, arr);
    });
    out = out.filter((a) =>
      Array.from(byField.entries()).every(([field, values]) => {
        const v = a[field];
        if (v == null) return false;
        const s = String(v).toLowerCase();
        return values.some((val) => s.includes(val));
      }),
    );
  }
  if (aiSelectedIds) {
    out = out.filter((a) => aiSelectedIds.has(a.id));
  }
  return out;
}
