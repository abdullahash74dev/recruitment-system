import { useRef, useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Download, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Target fields with Arabic labels (subset of applicants table)
const TARGETS: { key: string; label: string; required?: boolean }[] = [
  { key: "full_name", label: "الاسم الكامل", required: true },
  { key: "gender", label: "الجنس" },
  { key: "nationality", label: "الجنسية" },
  { key: "birth_date", label: "تاريخ الميلاد" },
  { key: "marital_status", label: "الحالة الاجتماعية" },
  { key: "dependents", label: "عدد المعالين" },
  { key: "phone", label: "رقم الجوال" },
  { key: "email", label: "البريد الإلكتروني" },
  { key: "current_city", label: "مقر السكن الحالي" },
  { key: "has_transport", label: "وسيلة مواصلات" },
  { key: "desired_position", label: "الوظيفة المرغوبة" },
  { key: "job_type", label: "نوع العمل" },
  { key: "preferred_city", label: "المدينة المفضلة" },
  { key: "hear_about", label: "كيف سمعت عن الفرصة" },
  { key: "education_level", label: "المؤهل العلمي" },
  { key: "major", label: "التخصص" },
  { key: "university", label: "الجامعة / المعهد" },
  { key: "graduation_year", label: "سنة التخرج" },
  { key: "gpa", label: "المعدل التراكمي" },
  { key: "currently_studying", label: "هل ملتحق بدراسة حالياً" },
  { key: "current_study", label: "الدراسة الحالية" },
  { key: "years_experience", label: "سنوات الخبرة" },
  { key: "currently_employed", label: "هل على رأس العمل" },
  { key: "current_title", label: "المسمى الوظيفي الحالي" },
  { key: "current_tasks", label: "المهام الحالية" },
  { key: "self_summary", label: "نبذة عن نفسك" },
  { key: "other_experience", label: "خبرات أخرى" },
  { key: "arabic_level", label: "مستوى العربية" },
  { key: "english_level", label: "مستوى الإنجليزية" },
  { key: "other_language", label: "لغة أخرى / مستواها" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "facility_management_exp", label: "خبرة إدارة المرافق" },
  { key: "current_salary", label: "الراتب الحالي" },
  { key: "expected_salary", label: "الراتب المتوقع" },
  { key: "available_date", label: "موعد الانضمام" },
  { key: "resume_url", label: "رابط السيرة الذاتية" },
  { key: "degree_url", label: "رابط المؤهل العلمي" },
  { key: "experience_cert_url", label: "شهادة الخبرة" },
  { key: "training_certs_url", label: "شهادات التدريب" },
  { key: "other_docs_url", label: "مستندات إضافية" },
  { key: "notes", label: "الملاحظات" },
  { key: "status", label: "الحالة" },
  { key: "created_at", label: "تاريخ التقديم (الطابع الزمني)" },
];

// Normalize Arabic header for matching: strip diacritics, unify letters, collapse spaces
const normAr = (s: string) =>
  String(s || "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// Auto-mapping presets: matcher receives normalized header
const AUTO_MAP_PRESETS: { match: (h: string) => boolean; target: string }[] = [
  { match: h => /الاسم\s*الكامل|الاسم\s*رباعي|الاسم\s*الرباعي|^الاسم$/.test(h), target: "full_name" },
  { match: h => /^الجنس$|النوع/.test(h), target: "gender" },
  { match: h => /جنسي/.test(h), target: "nationality" },
  { match: h => /تاريخ\s*الميلاد|الميلاد|مواليد/.test(h), target: "birth_date" },
  { match: h => /اجتماع|العائلي/.test(h), target: "marital_status" },
  { match: h => /معالين|عدد\s*الافراد/.test(h), target: "dependents" },
  { match: h => /جوال|هاتف|محمول|موبايل|رقم\s*التواصل/.test(h), target: "phone" },
  { match: h => /بريد|ايميل|الالكتروني|e[- ]?mail|email/.test(h), target: "email" },
  { match: h => /(سكن|مدينه|مقر)\s*(الحالي|الحالى)?|مكان\s*الاقامه|الاقامه/.test(h), target: "current_city" },
  { match: h => /مواصلات|وسيله\s*نقل|سياره/.test(h), target: "has_transport" },
  { match: h => /وظيفه\s*المرغوب|وظيفه\s*المطلوب|الوظيفه|المنصب|المسمي\s*المطلوب/.test(h), target: "desired_position" },
  { match: h => /نوع\s*الدوام|نوع\s*العمل/.test(h), target: "job_type" },
  { match: h => /المدينه\s*المفضله|مكان\s*العمل\s*المفضل/.test(h), target: "preferred_city" },
  { match: h => /كيف\s*سمعت|مصدر/.test(h), target: "hear_about" },
  { match: h => /(المؤهل|الشهاده)\s*(العلميه|الحاليه|الدراسيه)?|الدرجه\s*العلميه|المستوي\s*التعليمي|التعليم/.test(h), target: "education_level" },
  { match: h => /تخصص/.test(h), target: "major" },
  { match: h => /جامعه|معهد|كليه|جهه\s*الدراسه/.test(h), target: "university" },
  { match: h => /سنه\s*التخرج|تاريخ\s*التخرج/.test(h), target: "graduation_year" },
  { match: h => /معدل|gpa/.test(h), target: "gpa" },
  { match: h => /ملتحق\s*بدراسه|هل\s*تدرس|تدرس\s*حاليا/.test(h), target: "currently_studying" },
  { match: h => /الدراسه\s*الحاليه|ماهي\s*الدراسه|نوع\s*الدراسه/.test(h), target: "current_study" },
  { match: h => /سنوات\s*الخبره|مده\s*الخبره|الخبره\s*العمليه/.test(h), target: "years_experience" },
  { match: h => /(علي\s*راس|راس)\s*العمل|تعمل\s*حاليا|موظف\s*حاليا/.test(h), target: "currently_employed" },
  { match: h => /المسمي\s*الوظيفي|الوظيفه\s*الحاليه/.test(h), target: "current_title" },
  { match: h => /نبذه\s*عن\s*المهام|المهام\s*الحاليه|المهام\s*والمسؤوليات|مهام\s*العمل|الواجبات/.test(h), target: "current_tasks" },
  { match: h => /نبذه\s*عن\s*نفسك|ملخص\s*مهني|تعريف\s*شخصي/.test(h), target: "self_summary" },
  { match: h => /خبرات\s*(اخري|الاخري)|خبره\s*اضافيه|الخبره\s*السابقه/.test(h), target: "other_experience" },
  { match: h => /العربيه|arabic/i.test(h), target: "arabic_level" },
  { match: h => /انجليزيه|english/i.test(h), target: "english_level" },
  { match: h => /(تعرف|تجيد)\s*لغه\s*(اخري|اخرى)/.test(h), target: "other_language" },
  { match: h => /اللغه\s*الاخري|مستوي\s*اللغه\s*الاخري|لغات\s*اخري/.test(h), target: "other_language" },
  { match: h => /التشغيل|الصيانه|اداره\s*المرافق|facility/i.test(h), target: "facility_management_exp" },
  { match: h => /الراتب\s*(الحالي|الاخير)/.test(h), target: "current_salary" },
  { match: h => /الراتب\s*المتوقع|الراتب\s*المطلوب/.test(h), target: "expected_salary" },
  { match: h => /موعد\s*الانضمام|موعد\s*المباشره|تاريخ\s*المباشره|متي\s*تستطيع/.test(h), target: "available_date" },
  { match: h => /السيره\s*الذاتيه|cv|resume/i.test(h), target: "resume_url" },
  { match: h => /رابط\s*المؤهل|رابط\s*الشهاده|شهاده\s*التخرج/.test(h), target: "degree_url" },
  { match: h => /شهاده\s*الخبره|خطاب\s*خبره/.test(h), target: "experience_cert_url" },
  { match: h => /الدورات|دورات\s*تدريبيه|شهادات\s*التدريب/.test(h), target: "training_certs_url" },
  { match: h => /مستندات\s*اضافيه|مرفقات\s*اضافيه|وثائق\s*اخري/.test(h), target: "other_docs_url" },
  { match: h => /ملاحظ/.test(h), target: "notes" },
  { match: h => /linkedin|لينكد/i.test(h), target: "linkedin" },
  { match: h => /الطابع\s*الزمني|تاريخ\s*التقديم|وقت\s*التقديم|تاريخ\s*الارسال|تاريخ\s*الإرسال|وقت\s*الارسال|وقت\s*الإرسال|وقت\s*الاكمال|وقت\s*الإكمال|completion\s*time|start\s*time|timestamp|submitted|submission|submit\s*time/i.test(h), target: "created_at" },
];


interface Props { onChanged: () => void; }

const STORAGE_KEY = "applicants_mapped_import_draft_v1";
const ALLOWED_STATUSES = new Set(["new", "reviewing", "phone_interview", "in_person_interview", "accepted", "hired", "rejected", "withdrawn"]);

const ApplicantsMappedImport = ({ onChanged }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [savedAt, setSavedAt] = useState<string>("");
  // mapping: target -> sourceHeader (or "" = skip)
  const [mapping, setMapping] = useState<Record<string, string>>({});
  // enabled: target -> boolean
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  // Raw sheet rows (no header inferred yet) — lets the user pick which row holds the real
  // column titles instead of forcing them to delete title/blank rows from the file first.
  const [rawSheet, setRawSheet] = useState<any[][] | null>(null);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [showHeaderPicker, setShowHeaderPicker] = useState(false);
  // Multi-sheet support: keep the parsed workbook around so the user can switch sheets
  // (or append rows from a second sheet) without re-uploading the file.
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [sourceSheets, setSourceSheets] = useState<string[]>([]);
  const [appendMode, setAppendMode] = useState(false);
  // Custom fields: lets the user map a column that has no matching field in the system
  // (e.g. an extra Google Forms question) — stored per-applicant as JSON in extra_fields.
  const [customFields, setCustomFields] = useState<{ key: string; label: string }[]>([]);
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const nextCustomIdRef = useRef(1);

  // Restore draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.rows?.length) {
        setHeaders(d.headers || []);
        setRows(d.rows || []);
        setMapping(d.mapping || {});
        setEnabled(d.enabled || {});
        setFileName(d.fileName || "");
        setSavedAt(d.savedAt || "");
        setCustomFields(d.customFields || []);
      }
    } catch {}
  }, []);

  // Persist draft whenever data changes
  useEffect(() => {
    if (rows.length === 0) return;
    try {
      const payload = JSON.stringify({
        headers, rows, mapping, enabled, fileName, customFields,
        savedAt: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_KEY, payload);
      setSavedAt(new Date().toISOString());
    } catch (e) {
      // quota exceeded — silently drop the rows from persistence
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }, [headers, rows, mapping, enabled, fileName, customFields]);

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHeaders([]); setRows([]); setMapping({}); setEnabled({});
    setFileName(""); setSavedAt(""); setResult(null);
    setRawSheet(null); setShowHeaderPicker(false); setHeaderRowIdx(0);
    setWorkbook(null); setSheetNames([]); setSelectedSheet(""); setSourceSheets([]); setAppendMode(false);
    setCustomFields([]); setShowAddField(false); setNewFieldLabel("");
    toast.success("تم مسح المسودة");
  };

  const addCustomField = (label: string, fromHeader?: string) => {
    const trimmed = label.trim();
    if (!trimmed) { toast.error("اكتب اسماً للحقل أولاً"); return; }
    const key = `custom_${nextCustomIdRef.current++}`;
    setCustomFields(p => [...p, { key, label: trimmed }]);
    setMapping(p => ({ ...p, [key]: fromHeader || "" }));
    setEnabled(p => ({ ...p, [key]: true }));
  };

  const removeCustomField = (key: string) => {
    setCustomFields(p => p.filter(f => f.key !== key));
    setMapping(p => { const n = { ...p }; delete n[key]; return n; });
    setEnabled(p => { const n = { ...p }; delete n[key]; return n; });
  };

  const autoMap = (hdrs: string[]) => {
    const map: Record<string, string> = {};
    const en: Record<string, boolean> = {};
    TARGETS.forEach(t => { map[t.key] = ""; en[t.key] = !!t.required; });
    for (const h of hdrs) {
      const cleaned = normAr(h);
      if (!cleaned) continue;
      for (const p of AUTO_MAP_PRESETS) {
        if (p.match(cleaned) && !map[p.target]) {
          map[p.target] = h;
          en[p.target] = true;
          break;
        }
      }
    }
    return { map, en };
  };

  // Guess which of the first few rows holds the real column titles: title/blank rows
  // usually have far fewer filled cells than an actual header row.
  const guessHeaderRow = (raw: any[][]): number => {
    let best = 0, bestScore = -1;
    for (let i = 0; i < Math.min(raw.length, 15); i++) {
      const nonEmpty = (raw[i] || []).filter(c => String(c ?? "").trim() !== "").length;
      if (nonEmpty > bestScore) { bestScore = nonEmpty; best = i; }
    }
    return best;
  };

  const parseSheetRaw = (wb: XLSX.WorkBook, sheetName: string): any[][] => {
    const ws = wb.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, dateNF: 'yyyy-mm-dd"T"hh:mm:ss' });
  };

  // Pick the sheet most likely to hold the real data: compare each sheet's row span
  // (fast — reads the sheet dimensions, not its full content) instead of always assuming
  // the first sheet, since exports often have an empty/summary sheet before the data sheet.
  const pickBestSheet = (wb: XLSX.WorkBook): string => {
    let best = wb.SheetNames[0];
    let bestScore = -1;
    for (const name of wb.SheetNames) {
      const ref = wb.Sheets[name]?.["!ref"];
      const score = ref ? XLSX.utils.decode_range(ref).e.r + 1 : 0;
      if (score > bestScore) { bestScore = score; best = name; }
    }
    return best;
  };

  const selectSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const raw = parseSheetRaw(wb, sheetName);
    setSelectedSheet(sheetName);
    setRawSheet(raw);
    setHeaderRowIdx(guessHeaderRow(raw));
    setShowHeaderPicker(true);
    if (raw.length === 0) toast.warning(`الشيت "${sheetName}" يبدو فارغاً — جرّب اختيار شيت آخر من القائمة بالأعلى.`);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      if (wb.SheetNames.length === 0) throw new Error("الملف لا يحتوي على أي شيت بيانات");
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      setSourceSheets([]);
      setAppendMode(false);
      setFileName(file.name);
      setHeaders([]);
      setRows([]);
      setResult(null);
      selectSheet(wb, pickBestSheet(wb));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Open the same sheet/header picker but in "append" mode: confirming will add the chosen
  // sheet's rows on top of the rows already loaded instead of replacing them — this is how
  // the user combines e.g. Sheet 2 and Sheet 3 of the same workbook into one import batch.
  const startAppendFromSheet = () => {
    if (!workbook) return;
    setAppendMode(true);
    const other = sheetNames.find(n => n !== selectedSheet) || sheetNames[0];
    selectSheet(workbook, other);
  };

  const applyHeaderRow = (idx: number) => {
    if (!rawSheet) return;
    const headerCells = rawSheet[idx] || [];
    const seen = new Map<string, number>();
    const hdrs = headerCells.map((c, i) => {
      let name = String(c ?? "").trim();
      if (!name) name = `عمود ${i + 1}`;
      const count = seen.get(name) || 0;
      seen.set(name, count + 1);
      return count > 0 ? `${name} (${count + 1})` : name;
    });
    const dataRows = rawSheet
      .slice(idx + 1)
      .filter(r => r.some(c => String(c ?? "").trim() !== ""))
      .map(r => {
        const obj: Record<string, any> = {};
        hdrs.forEach((h, i) => { obj[h] = r[i] ?? ""; });
        return obj;
      });
    setHeaderRowIdx(idx);
    setShowHeaderPicker(false);

    if (appendMode) {
      setRows(prev => [...prev, ...dataRows]);
      setHeaders(prev => {
        const merged = [...prev];
        hdrs.forEach(h => { if (!merged.includes(h)) merged.push(h); });
        return merged;
      });
      setSourceSheets(prev => prev.includes(selectedSheet) ? prev : [...prev, selectedSheet]);
      setAppendMode(false);
      toast.success(`تمت إضافة ${dataRows.length} صف من شيت "${selectedSheet}".`);
    } else {
      setHeaders(hdrs);
      setRows(dataRows);
      setSourceSheets([selectedSheet]);
      const { map, en } = autoMap(hdrs);
      setMapping(map);
      setEnabled(en);
      toast.success(`تم تحميل ${dataRows.length} صف من شيت "${selectedSheet}". تم ربط ${Object.values(map).filter(Boolean).length} حقل تلقائياً.`);
    }
  };

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const makeDateOnly = (year: number, month: number, day: number): string | null => {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const oldestAllowed = new Date(Date.UTC(today.getFullYear() - 100, today.getMonth(), today.getDate()));
    if (dt > todayUtc || dt < oldestAllowed) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const normalizeYear = (year: string) => {
    const n = Number(year);
    if (!Number.isInteger(n)) return NaN;
    return year.length === 2 ? n + (n < 50 ? 2000 : 1900) : n;
  };

  const normalizeDate = (value: any) => {
    if (value == null || value === "") return null;
    // Excel serial number (preserves the spreadsheet date instead of relying on JS locale parsing)
    if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value).trim())) {
      const n = Number(value);
      if (n > 0 && n < 80000) {
        const parsed = XLSX.SSF.parse_date_code(n);
        if (parsed) return makeDateOnly(parsed.y, parsed.m, parsed.d);
      }
    }
    if (value instanceof Date) return makeDateOnly(value.getFullYear(), value.getMonth() + 1, value.getDate());
    const s = toLatinDigits(value);
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      const y = normalizeYear(m[3]);
      const a = Number(m[1]);
      const b = Number(m[2]);
      return makeDateOnly(y, b, a) || makeDateOnly(y, a, b);
    }
    const iso = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (iso) return makeDateOnly(Number(iso[1]), Number(iso[2]), Number(iso[3])) || makeDateOnly(Number(iso[1]), Number(iso[3]), Number(iso[2]));
    return null;
  };

  const toLatinDigits = (value: any) => String(value ?? "")
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[،,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const makeLocalIso = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0) => {
    const d = new Date(year, month - 1, day, hour, minute, second);
    if (
      d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day ||
      d.getHours() !== hour || d.getMinutes() !== minute || d.getSeconds() !== second
    ) return null;
    return d.toISOString();
  };

  const inferDateTimeOrder = (values: any[]): "dmy" | "mdy" => {
    let dmy = 0, mdy = 0;
    for (const value of values.slice(0, 250)) {
      const s = toLatinDigits(value);
      const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
      if (!m) continue;
      const a = Number(m[1]), b = Number(m[2]);
      if (a > 12 && b <= 12) dmy += 3;
      if (b > 12 && a <= 12) mdy += 3;
    }
    return dmy >= mdy ? "dmy" : "mdy";
  };

  const normalizeDateTime = (value: any, preferredOrder: "dmy" | "mdy" = "dmy"): string | null => {
    if (value == null || value === "") return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString();
    // Excel serial (with fractional time)
    if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value).trim())) {
      const n = Number(value);
      if (n > 0 && n < 80000) {
        const parsed = XLSX.SSF.parse_date_code(n);
        if (parsed) return makeLocalIso(parsed.y, parsed.m, parsed.d, parsed.H || 0, parsed.M || 0, Math.floor(parsed.S || 0));
      }
    }
    const original = toLatinDigits(value);
    const ampm = /(pm|مساء|\bم\b)/i.test(original) ? "pm" : /(am|صباح|\bص\b)/i.test(original) ? "am" : "";
    const s = original.replace(/(am|pm|صباحاً|صباحا|صباح|مساءً|مساء|\b[صم]\b\.?)/gi, "").trim();
    const isoMatch = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[ T]+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/);
    if (isoMatch) {
      let hh = Number(isoMatch[4] || 0);
      if (ampm === "pm" && hh < 12) hh += 12;
      if (ampm === "am" && hh === 12) hh = 0;
      const y = Number(isoMatch[1]);
      const a = Number(isoMatch[2]);
      const b = Number(isoMatch[3]);
      return makeLocalIso(y, a, b, hh, Number(isoMatch[5] || 0), Number(isoMatch[6] || 0))
        || makeLocalIso(y, b, a, hh, Number(isoMatch[5] || 0), Number(isoMatch[6] || 0));
    }
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T]+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/);
    if (m) {
      let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      let y = m[3]; if (y.length === 2) y = "20" + y;
      let day: number, mon: number;
      if (a > 12 && b <= 12) { day = a; mon = b; }
      else if (b > 12 && a <= 12) { day = b; mon = a; }
      else if (preferredOrder === "dmy") { day = a; mon = b; }
      else { day = b; mon = a; }
      let hh = parseInt(m[4] || "0", 10);
      if (ampm === "pm" && hh < 12) hh += 12;
      if (ampm === "am" && hh === 12) hh = 0;
      return makeLocalIso(Number(y), mon, day, hh, Number(m[5] || 0), Number(m[6] || 0));
    }
    return null;
  };

  const sanitizeApplicantDates = (row: any) => {
    const safe = { ...row };
    if (safe.birth_date) {
      const fixedBirthDate = normalizeDate(safe.birth_date);
      if (!fixedBirthDate) return { safe, error: "تاريخ ميلاد غير منطقي (تم رفض السجل قبل الحفظ)" };
      safe.birth_date = fixedBirthDate;
    }
    if (safe.created_at) {
      const fixedCreatedAt = normalizeDateTime(safe.created_at, "dmy");
      if (fixedCreatedAt) safe.created_at = fixedCreatedAt;
      else delete safe.created_at;
    }
    return { safe };
  };


  const normalizeSalary = (value: any) => {
    if (value == null || value === "") return null;
    const s = String(value).trim();
    const range = s.match(/(\d[\d,.]*)\s*(?:-|–|to|إلى|الى|حتى)\s*(\d[\d,.]*)/i);
    if (range) {
      const a = Number.parseFloat(range[1].replace(/,/g, ""));
      const b = Number.parseFloat(range[2].replace(/,/g, ""));
      if (!Number.isNaN(a) && !Number.isNaN(b)) return String(Math.round((a + b) / 2));
    }
    const n = Number.parseFloat(s.replace(/[^\d.]/g, ""));
    return Number.isNaN(n) ? s : String(Math.round(n));
  };

  const normalizeYesNo = (value: any) => {
    const s = String(value ?? "").trim().toLowerCase();
    if (["نعم", "yes", "y", "true", "1"].includes(s)) return "نعم";
    if (["لا", "no", "n", "false", "0"].includes(s)) return "لا";
    return String(value ?? "").trim() || null;
  };

  const normalizeStatus = (value: any): string => {
    const s = String(value ?? "").trim().toLowerCase();
    if (ALLOWED_STATUSES.has(s)) return s;
    if (/جديد|new/.test(s)) return "new";
    if (/مراجع|review/.test(s)) return "reviewing";
    if (/هاتف|phone/.test(s)) return "phone_interview";
    if (/شخص|حضوري|in.?person/.test(s)) return "in_person_interview";
    if (/توظيف|hired/.test(s)) return "hired";
    if (/مقبول|قبول|accepted/.test(s)) return "accepted";
    if (/مرفوض|reject/.test(s)) return "rejected";
    if (/منسحب|withdraw/.test(s)) return "withdrawn";
    return "new";
  };

  const buildRecords = () => {
    const cleanMap: Record<string, string | null> = {};
    for (const t of TARGETS) cleanMap[t.key] = enabled[t.key] && mapping[t.key] ? mapping[t.key] : null;
    const customClean = customFields.filter(f => enabled[f.key] && mapping[f.key]);
    const dateTimeOrder = cleanMap.created_at ? inferDateTimeOrder(rows.map(r => r[cleanMap.created_at as string])) : "dmy";
    const valid: any[] = [];
    const errors: any[] = [];
    rows.forEach((src, index) => {
      const rec: any = { status: "new", dependents: 0 };
      for (const [target, sourceHeader] of Object.entries(cleanMap)) {
        if (!sourceHeader) continue;
        const raw = src[sourceHeader];
        const value = typeof raw === "string" ? raw.trim() : raw;
        if (target === "birth_date") {
          rec.birth_date = normalizeDate(value);
          if (value !== "" && value != null && !rec.birth_date) {
            errors.push({ row: index + 2, name: rec.full_name, errors: ["تاريخ ميلاد غير منطقي (سيتم رفض السجل)"] });
            return;
          }
        }
        else if (target === "created_at") {
          const dt = normalizeDateTime(value, dateTimeOrder);
          if (dt) rec.created_at = dt;
        }
        else if (target === "dependents") rec.dependents = Number.parseInt(String(value || "0"), 10) || 0;
        else if (target === "current_salary" || target === "expected_salary") rec[target] = normalizeSalary(value);
        else if (["has_transport", "currently_studying", "currently_employed"].includes(target)) rec[target] = normalizeYesNo(value);
        else if (target === "status") {
          rec.status = normalizeStatus(value);
        }
        else rec[target] = value === "" || value == null ? null : String(value);
      }
      if (customClean.length > 0) {
        const extra: Record<string, string> = {};
        for (const f of customClean) {
          const raw = src[mapping[f.key]];
          const value = typeof raw === "string" ? raw.trim() : raw;
          if (value !== "" && value != null) extra[f.label] = String(value);
        }
        if (Object.keys(extra).length > 0) rec.extra_fields = extra;
      }
      if (!rec.full_name || String(rec.full_name).trim().length < 2) {
        errors.push({ row: index + 2, name: rec.full_name, errors: ["الاسم الكامل مفقود"] });
        return;
      }
      if (rec.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(rec.email))) rec.email = null;
      valid.push(rec);
    });
    return { cleanMap, valid, errors };
  };

  const [currentName, setCurrentName] = useState<string>("");
  const [recentLog, setRecentLog] = useState<{ name: string; ok: boolean; msg?: string }[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [importSource, setImportSource] = useState<"direct" | "external">("direct");
  const [sourceCompany, setSourceCompany] = useState<string>("");
  const cancelRef = useRef<boolean>(false);

  const dupKeys = (r: any) => {
    const n = String(r.full_name || "").trim().toLowerCase().replace(/\s+/g, " ");
    const p = String(r.phone || "").replace(/\D/g, "");
    const e = String(r.email || "").trim().toLowerCase();
    const pos = String(r.desired_position || "").trim().toLowerCase();
    const keys: string[] = [];
    if (n && p && e && pos) keys.push(`all:${n}|${p}|${e}|${pos}`);
    if (n && p && pos) keys.push(`name_phone_pos:${n}|${p}|${pos}`);
    if (n && e && pos) keys.push(`name_email_pos:${n}|${e}|${pos}`);
    if (n && p && e) keys.push(`name_phone_email:${n}|${p}|${e}`);
    if (n && p) keys.push(`name_phone:${n}|${p}`);
    if (n && e) keys.push(`name_email:${n}|${e}`);
    return keys;
  };
  const richness = (r: any) => Object.values(r).filter(v => v != null && String(v).trim() !== "").length;

  const INSERT_BATCH_SIZE = 500;

  const submit = async () => {
    const { cleanMap, valid, errors: localErrors } = buildRecords();
    if (!cleanMap["full_name"]) {
      toast.error("يجب تعيين عمود الاسم الكامل");
      return;
    }
    setLoading(true);
    setResult(null);
    setRecentLog([]);
    setCurrentName("");
    cancelRef.current = false;
    setProgress({ done: 0, total: valid.length });
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [...localErrors];
    try {
      if (valid.length === 0) {
        setResult({ inserted: 0, failed: errors.length, total: errors.length, errors: errors.slice(0, 500) });
        toast.error("لا توجد صفوف صالحة للحفظ؛ راجع تقرير الأخطاء.");
        return;
      }

      // Build duplicate index from existing applicants (paginated)
      const existingMap = new Map<string, { id: string | null; record: any; pendingIdx?: number }>();
      if (skipDuplicates) {
        setCurrentName("جاري تحميل المتقدمين الحاليين للمقارنة...");
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase
            .from("applicants")
            .select("*")
            .range(from, from + 999);
          if (error) throw error;
          (data || []).forEach((row: any) => {
            for (const k of dupKeys(row)) {
              const prev = existingMap.get(k);
              if (!prev || richness(row) > richness(prev.record)) existingMap.set(k, { id: row.id, record: row });
            }
          });
          if (!data || data.length < 1000) break;
        }
      }

      // Phase 1: classify every row in-memory (no network calls) — this preserves duplicate
      // detection both against the DB and between rows of the same uploaded file exactly like
      // the previous row-by-row loop did, just without paying a network round-trip per row.
      setCurrentName("جارٍ تصنيف الصفوف...");
      const toInsert: any[] = [];
      const toInsertRows: number[] = [];
      const toUpdate: { id: string; created_at: string; name: string; row: number }[] = [];

      for (let i = 0; i < valid.length; i++) {
        const row = valid[i];
        const { safe: safeRowBase, error: dateError } = sanitizeApplicantDates(row);
        if (dateError) {
          errors.push({ row: i + 2, name: row.full_name, errors: [dateError] });
          continue;
        }
        const safeRow: any = { ...safeRowBase, source: importSource };
        if (importSource === "external") safeRow.source_company = sourceCompany.trim() || null;
        const keys = dupKeys(safeRow);
        const existing = skipDuplicates ? keys.map(k => existingMap.get(k)).find(Boolean) : undefined;
        if (existing) {
          const changed = !!safeRow.created_at && new Date(safeRow.created_at).getTime() !== new Date(existing.record.created_at).getTime();
          if (changed) {
            if (existing.pendingIdx != null) {
              // duplicate of a row earlier in this same file that hasn't been inserted yet —
              // merge directly into its pending record instead of an extra DB round-trip.
              toInsert[existing.pendingIdx].created_at = safeRow.created_at;
              keys.forEach(k => existingMap.set(k, { id: null, record: { ...existing.record, created_at: safeRow.created_at }, pendingIdx: existing.pendingIdx }));
            } else {
              toUpdate.push({ id: existing.id as string, created_at: safeRow.created_at, name: row.full_name, row: i + 2 });
              keys.forEach(k => existingMap.set(k, { id: existing.id, record: { ...existing.record, created_at: safeRow.created_at } }));
            }
            updated += 1;
          } else {
            skipped += 1;
          }
        } else {
          const idx = toInsert.length;
          toInsert.push(safeRow);
          toInsertRows.push(i + 2);
          keys.forEach(k => existingMap.set(k, { id: null, record: safeRow, pendingIdx: idx }));
        }
      }

      const totalWork = toInsert.length + toUpdate.length;
      let done = 0;
      setProgress({ done, total: totalWork });

      // Phase 2: insert new rows in large batches through the import-applicants-mapped edge
      // function (which itself chunks into groups of 200 server-side) instead of one request
      // per row — this is what makes 80,000+-row files feasible.
      for (let b = 0; b < toInsert.length; b += INSERT_BATCH_SIZE) {
        if (cancelRef.current) { toast.warning("تم إيقاف الاستيراد"); break; }
        const batch = toInsert.slice(b, b + INSERT_BATCH_SIZE);
        const batchRows = toInsertRows.slice(b, b + INSERT_BATCH_SIZE);
        const batchNum = Math.floor(b / INSERT_BATCH_SIZE) + 1;
        const batchTotal = Math.ceil(toInsert.length / INSERT_BATCH_SIZE);
        setCurrentName(`جارٍ حفظ دفعة ${batchNum} من ${batchTotal} (${batch.length} صف)...`);

        let res: any = null;
        let lastError: any = null;
        for (let attempt = 0; attempt < 2 && !res; attempt++) {
          if (attempt > 0) await new Promise(r => setTimeout(r, 1500));
          const { data, error } = await supabase.functions.invoke("import-applicants-mapped", { body: { records: batch } });
          if (!error) res = data; else lastError = error;
        }

        if (res) {
          inserted += res.inserted || 0;
          (res.errors || []).forEach((e: any) => {
            const idx = e.row - 2;
            const absRow = batchRows[idx];
            errors.push({ row: absRow ?? e.row, name: e.name, errors: e.errors });
          });
          setRecentLog(p => [{ name: `دفعة ${batchNum}/${batchTotal}`, ok: (res.failed || 0) === 0, msg: `${res.inserted} تم${res.failed ? ` · ${res.failed} فشل` : ""}` }, ...p].slice(0, 15));
        } else {
          const msg = lastError?.message || "فشل الاتصال بالخادم";
          batchRows.forEach((r, idx) => errors.push({ row: r, name: batch[idx]?.full_name, errors: [msg] }));
          setRecentLog(p => [{ name: `دفعة ${batchNum}/${batchTotal}`, ok: false, msg }, ...p].slice(0, 15));
        }
        done += batch.length;
        setProgress({ done, total: totalWork });
        setResult({ inserted, updated, skipped, failed: errors.length, total: valid.length + localErrors.length, errors: errors.slice(0, 500) });
      }

      // Phase 3: timestamp-only updates for rows that duplicate an already-existing DB record.
      for (let i = 0; i < toUpdate.length; i++) {
        if (cancelRef.current) { toast.warning("تم إيقاف الاستيراد"); break; }
        const u = toUpdate[i];
        setCurrentName(u.name || `صف ${u.row}`);
        const { error } = await supabase.from("applicants").update({ created_at: u.created_at }).eq("id", u.id);
        if (error) {
          errors.push({ row: u.row, name: u.name, errors: [`تحديث وقت التقديم للمكرر فشل: ${error.message}`] });
          setRecentLog(p => [{ name: u.name, ok: false, msg: error.message }, ...p].slice(0, 15));
        } else {
          setRecentLog(p => [{ name: u.name, ok: true, msg: "تم تحديث وقت التقديم فقط" }, ...p].slice(0, 15));
        }
        done += 1;
        setProgress({ done, total: totalWork });
        setResult({ inserted, updated, skipped, failed: errors.length, total: valid.length + localErrors.length, errors: errors.slice(0, 500) });
      }

      setProgress({ done: totalWork, total: totalWork });
      setResult({ inserted, updated, skipped, failed: errors.length, total: valid.length + localErrors.length, errors: errors.slice(0, 500), cancelled: cancelRef.current });
      if (inserted > 0 || updated > 0) {
        toast.success(`تم: ${inserted} جديد · ${updated} محدّث · ${skipped} متخطى`);
        onChanged();
      }
      if (errors.length > 0) toast.warning(`${errors.length} صف لم يُحفظ — راجع التقرير`);
      if (inserted === 0 && updated === 0 && !cancelRef.current) toast.error("لم يتم حفظ أي صف؛ راجع تقرير الأخطاء.");
    } catch (err: any) {
      toast.error(err.message);
      setResult({ error: err.message, inserted, failed: errors.length, total: valid.length, errors });
    } finally {
      setLoading(false);
      setCurrentName("");
      cancelRef.current = false;
    }
  };


  const downloadErrors = () => {
    if (!result?.errors?.length) return;
    const ws = XLSX.utils.json_to_sheet(result.errors.map((e: any) => ({
      row: e.row, name: e.name, errors: e.errors.join(" | "),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, `mapped_import_errors_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const mappedCount = useMemo(
    () => TARGETS.filter(t => enabled[t.key] && mapping[t.key]).length
      + customFields.filter(f => enabled[f.key] && mapping[f.key]).length,
    [enabled, mapping, customFields]
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-muted/30">
        <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">استيراد مرن (Google Form / Excel):</span>
        <Button size="sm" variant="default" onClick={() => setOpen(true)} className="gap-1">
          <Wand2 className="w-3.5 h-3.5" />
          فتح أداة الاستيراد المرن
        </Button>
        <span className="text-xs text-muted-foreground">ارفع أي ملف Excel/CSV ثم اربط الأعمدة وفعّل/عطّل ما تريد.</span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5 text-primary" />استيراد مرن للمرشحين</DialogTitle>
            <DialogDescription>
              ارفع ملف Excel أو CSV (مثل تصدير Google Forms). سيتم ربط الأعمدة تلقائياً، ويمكنك تعطيل أي عمود قبل الاستيراد.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4 pr-1">
            <div className="flex flex-wrap gap-2 items-center">
              <Button onClick={() => fileRef.current?.click()} className="gap-1">
                <Upload className="w-4 h-4" /> اختر ملف Excel / CSV
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              {headers.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {fileName && <b className="me-1">{fileName}</b>}
                  {sourceSheets.length > 0 && <span className="me-1">(شيت: {sourceSheets.join("، ")})</span>}
                  {headers.length} عمود · {rows.length} صف · مفعّل: {mappedCount}
                </span>
              )}
              {rows.length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearDraft} className="text-destructive">
                  مسح المسودة
                </Button>
              )}
              {rawSheet && !showHeaderPicker && (
                <Button size="sm" variant="outline" onClick={() => { setAppendMode(false); setShowHeaderPicker(true); }}>
                  تغيير صف العناوين
                </Button>
              )}
              {rawSheet && !showHeaderPicker && sheetNames.length > 1 && rows.length > 0 && (
                <Button size="sm" variant="outline" onClick={startAppendFromSheet}>
                  + إضافة بيانات من شيت آخر
                </Button>
              )}
              <div className="flex items-center gap-2 ms-auto">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Switch checked={skipDuplicates} onCheckedChange={setSkipDuplicates} />
                  <span>مطابقة المكرر — يحدّث تاريخ/وقت التقديم فقط ولا يدمج باقي البيانات</span>
                </label>
              </div>
            </div>

            {rawSheet && showHeaderPicker && (
              <div className="rounded-lg border p-3 space-y-2">
                {sheetNames.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap pb-1 border-b">
                    <span className="text-xs font-medium">الشيت (Sheet):</span>
                    <Select value={selectedSheet} onValueChange={(v) => workbook && selectSheet(workbook, v)}>
                      <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {sheetNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <span className="text-[11px] text-muted-foreground">تم اختيار الشيت الأكثر بيانات تلقائياً — غيّره هنا إذا احتجت.</span>
                  </div>
                )}
                <div className="text-sm font-semibold">
                  {appendMode
                    ? `أضف بيانات من شيت إضافي إلى الصفوف المحمّلة حالياً (${rows.length} صف) — حدد صف العناوين`
                    : "حدد الصف الذي يحتوي على عناوين الأعمدة (الاسم، الجنس، البريد...)"}
                </div>
                <div className="text-xs text-muted-foreground">
                  اضغط على رقم الصف الصحيح من القائمة أدناه، ثم اضغط "تأكيد". الصفوف فوقه (عنوان/فراغ) سيتم تجاهلها تلقائياً.
                </div>
                <div className="max-h-[40vh] overflow-auto border rounded-md divide-y">
                  {rawSheet.slice(0, 15).map((r, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setHeaderRowIdx(idx)}
                      className={`w-full flex items-stretch text-start ${idx === headerRowIdx ? "bg-primary/10" : "hover:bg-muted/40"}`}
                    >
                      <span className={`shrink-0 w-9 flex items-center justify-center text-xs font-mono ${idx === headerRowIdx ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}>
                        {idx + 1}
                      </span>
                      <span className="flex-1 overflow-x-auto flex gap-1.5 px-2 py-1.5 whitespace-nowrap">
                        {r.slice(0, 30).map((c, ci) => (
                          <span key={ci} className="px-1.5 py-0.5 rounded bg-muted/40 border text-[11px]">
                            {String(c ?? "").trim() || "—"}
                          </span>
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" onClick={() => applyHeaderRow(headerRowIdx)}>
                    {appendMode
                      ? `إلحاق شيت "${selectedSheet}" من الصف ${headerRowIdx + 1}`
                      : `تأكيد الصف ${headerRowIdx + 1} كعناوين الأعمدة`}
                  </Button>
                </div>
              </div>
            )}

            {/* مصدر البيانات */}
            <div className="rounded-lg border p-3 bg-amber-50 dark:bg-amber-950/20 space-y-2">
              <div className="text-sm font-semibold flex items-center gap-2">
                <span>📦 مصدر هذه الدفعة</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={importSource === "direct"} onChange={() => setImportSource("direct")} />
                  <span>تقديم مباشر على شركتنا</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={importSource === "external"} onChange={() => setImportSource("external")} />
                  <span>مستورد من شركة خارجية (بنك بيانات)</span>
                </label>
                {importSource === "external" && (
                  <input
                    type="text"
                    value={sourceCompany}
                    onChange={(e) => setSourceCompany(e.target.value)}
                    placeholder="اسم الشركة المصدر (مثلاً: شركة كذا)"
                    className="flex-1 min-w-[200px] h-8 px-2 rounded border bg-background text-sm"
                  />
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">سيتم تمييز هذه السجلات بشارة خاصة وفلتر مستقل في القائمة.</div>
            </div>
            {savedAt && rows.length > 0 && (
              <div className="text-xs text-emerald-600">
                💾 محفوظ تلقائياً ({new Date(savedAt).toLocaleString("ar")}) — سيبقى الملف بعد إعادة فتح الصفحة.
              </div>
            )}

            {headers.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-xs font-semibold border-b">
                  <div className="col-span-1 text-center">تفعيل</div>
                  <div className="col-span-4">الحقل في النظام</div>
                  <div className="col-span-7">العمود في الملف</div>
                </div>
                <div className="max-h-[50vh] overflow-auto">
                  {TARGETS.map(t => (
                    <div key={t.key} className="grid grid-cols-12 gap-2 px-3 py-1.5 border-b items-center text-sm">
                      <div className="col-span-1 flex justify-center">
                        <Switch
                          checked={!!enabled[t.key]}
                          onCheckedChange={(c) => setEnabled(p => ({ ...p, [t.key]: c }))}
                          disabled={t.required}
                        />
                      </div>
                      <div className="col-span-4">
                        {t.label}
                        {t.required && <span className="text-destructive ms-1">*</span>}
                        <div className="text-[10px] text-muted-foreground font-mono">{t.key}</div>
                      </div>
                      <div className="col-span-7">
                        <Select
                          value={mapping[t.key] || "__none__"}
                          onValueChange={(v) => setMapping(p => ({ ...p, [t.key]: v === "__none__" ? "" : v }))}
                          disabled={!enabled[t.key]}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="— غير معيّن —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— غير معيّن —</SelectItem>
                            {headers.map(h => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {headers.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 text-xs font-semibold border-b">
                  <span>حقول مخصصة (لعناوين غير موجودة في النظام)</span>
                  <Button size="sm" variant="outline" onClick={() => setShowAddField(v => !v)}>
                    + إضافة حقل جديد
                  </Button>
                </div>

                {showAddField && (
                  <div className="p-3 space-y-2 border-b bg-muted/20">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        placeholder="اسم الحقل الجديد (مثلاً: نوع الرخصة)"
                        className="flex-1 h-8 px-2 rounded border bg-background text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => { addCustomField(newFieldLabel); setNewFieldLabel(""); setShowAddField(false); }}
                      >
                        إضافة
                      </Button>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      أو اضغط على أحد عناوين الأعمدة غير المربوطة لاستخدام اسمه مباشرة كحقل جديد:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {headers
                        .filter(h => !Object.values(mapping).includes(h))
                        .map(h => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => { addCustomField(h, h); setShowAddField(false); }}
                            className="px-2 py-1 rounded border bg-background text-xs hover:bg-primary/10"
                          >
                            {h}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {customFields.length > 0 ? (
                  <div className="max-h-[30vh] overflow-auto">
                    {customFields.map(f => (
                      <div key={f.key} className="grid grid-cols-12 gap-2 px-3 py-1.5 border-b items-center text-sm">
                        <div className="col-span-1 flex justify-center">
                          <Switch
                            checked={!!enabled[f.key]}
                            onCheckedChange={(c) => setEnabled(p => ({ ...p, [f.key]: c }))}
                          />
                        </div>
                        <div className="col-span-4">{f.label}</div>
                        <div className="col-span-6">
                          <Select
                            value={mapping[f.key] || "__none__"}
                            onValueChange={(v) => setMapping(p => ({ ...p, [f.key]: v === "__none__" ? "" : v }))}
                            disabled={!enabled[f.key]}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="— غير معيّن —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— غير معيّن —</SelectItem>
                              {headers.map(h => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <Button
                            size="sm" variant="ghost"
                            className="text-destructive h-7 w-7 p-0"
                            onClick={() => removeCustomField(f.key)}
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !showAddField && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">لا توجد حقول مخصصة بعد.</div>
                )}
              </div>
            )}

            {loading && progress && (
              <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />
                    جارٍ حفظ: <b className="text-primary">{currentName || "..."}</b>
                  </span>
                  <span className="font-mono text-xs">{progress.done}/{progress.total} ({Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%)</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%` }} />
                </div>
                {recentLog.length > 0 && (
                  <ul className="text-xs space-y-0.5 max-h-32 overflow-auto">
                    {recentLog.map((l, i) => (
                      <li key={i} className={l.ok ? "text-emerald-600" : "text-destructive"}>
                        {l.ok ? "✓" : "✗"} {l.name}{l.msg ? ` — ${l.msg}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {result && !result.error && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-4 h-4" />تم: <b>{result.inserted}</b></span>
                  {typeof result.updated === "number" && <span className="text-primary">تحديث وقت: <b>{result.updated}</b></span>}
                  {typeof result.skipped === "number" && <span className="text-muted-foreground">مكرر بلا تغيير: <b>{result.skipped}</b></span>}
                  <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="w-4 h-4" />مرفوض: <b>{result.failed}</b></span>
                  <span className="text-muted-foreground">الإجمالي: {result.total}</span>
                  {result.failed > 0 && (
                    <Button size="sm" variant="outline" onClick={downloadErrors} className="gap-1 ms-auto">
                      <Download className="w-3.5 h-3.5" /> تقرير الأخطاء
                    </Button>
                  )}
                </div>
                {result.errors?.length > 0 && (
                  <ul className="text-xs space-y-1 max-h-40 overflow-auto">
                    {result.errors.slice(0,10).map((e: any, i: number) => (
                      <li key={i} className="border-l-2 border-destructive ps-2">
                        #{e.row} {e.name} — {e.errors.join(", ")}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {result?.error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {result.error}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t mt-3">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>إغلاق</Button>
            {loading && (
              <Button variant="destructive" onClick={() => { cancelRef.current = true; }} className="gap-1">
                إيقاف الاستيراد
              </Button>
            )}
            <Button onClick={submit} disabled={loading || rows.length === 0} className="gap-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {loading
                ? (progress ? `${progress.done}/${progress.total} — ${currentName || "..."}` : "جاري الحفظ...")
                : `حفظ ${rows.length} صف`}
            </Button>
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
};

export default ApplicantsMappedImport;
