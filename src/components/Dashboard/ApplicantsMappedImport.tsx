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
      }
    } catch {}
  }, []);

  // Persist draft whenever data changes
  useEffect(() => {
    if (rows.length === 0) return;
    try {
      const payload = JSON.stringify({
        headers, rows, mapping, enabled, fileName,
        savedAt: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_KEY, payload);
      setSavedAt(new Date().toISOString());
    } catch (e) {
      // quota exceeded — silently drop the rows from persistence
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }, [headers, rows, mapping, enabled, fileName]);

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHeaders([]); setRows([]); setMapping({}); setEnabled({});
    setFileName(""); setSavedAt(""); setResult(null);
    toast.success("تم مسح المسودة");
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false, dateNF: 'yyyy-mm-dd"T"hh:mm:ss' });
      if (json.length === 0) throw new Error("الملف فارغ");
      const hdrs = Object.keys(json[0]);
      setHeaders(hdrs);
      setRows(json);
      setFileName(file.name);
      const { map, en } = autoMap(hdrs);
      setMapping(map);
      setEnabled(en);
      setResult(null);
      toast.success(`تم تحميل ${json.length} صف. تم ربط ${Object.values(map).filter(Boolean).length} حقل تلقائياً.`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
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
      const existingMap = new Map<string, { id: string; record: any }>();
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

      for (let i = 0; i < valid.length; i++) {
        if (cancelRef.current) {
          toast.warning("تم إيقاف الاستيراد");
          break;
        }
        const row = valid[i];
        const { safe: safeRowBase, error: dateError } = sanitizeApplicantDates(row);
        if (dateError) {
          errors.push({ row: i + 2, name: row.full_name, errors: [dateError] });
          setRecentLog(p => [{ name: row.full_name, ok: false, msg: dateError }, ...p].slice(0, 15));
          continue;
        }
        const safeRow: any = { ...safeRowBase, source: importSource };
        if (importSource === "external") safeRow.source_company = sourceCompany.trim() || null;
        setCurrentName(row.full_name || `صف ${i + 2}`);
        const keys = dupKeys(safeRow);
        const existing = skipDuplicates ? keys.map(k => existingMap.get(k)).find(Boolean) : undefined;
        if (existing) {
          const merged: any = safeRow.created_at ? { created_at: safeRow.created_at } : {};
          const changed = !!merged.created_at && new Date(merged.created_at).getTime() !== new Date(existing.record.created_at).getTime();
          if (changed) {
            const { error } = await supabase.from("applicants").update(merged).eq("id", existing.id);
            if (error) {
              errors.push({ row: i + 2, name: row.full_name, errors: [`تحديث وقت التقديم للمكرر فشل: ${error.message}`] });
              setRecentLog(p => [{ name: row.full_name, ok: false, msg: error.message }, ...p].slice(0, 15));
            } else {
              updated += 1;
              keys.forEach(k => existingMap.set(k, { id: existing.id, record: { ...existing.record, ...merged } }));
              setRecentLog(p => [{ name: row.full_name, ok: true, msg: "تم تحديث وقت التقديم فقط" }, ...p].slice(0, 15));
            }
          } else {
            skipped += 1;
            setRecentLog(p => [{ name: row.full_name, ok: true, msg: row.created_at ? "مكرر — نفس وقت التقديم" : "مكرر — لا يوجد وقت تقديم" }, ...p].slice(0, 15));
          }
        } else {
          const { data, error } = await supabase.from("applicants").insert(safeRow).select("id").single();
          if (error) {
            errors.push({ row: i + 2, name: row.full_name, errors: [error.message] });
            setRecentLog(p => [{ name: row.full_name, ok: false, msg: error.message }, ...p].slice(0, 15));
          } else {
            inserted += 1;
            if (data?.id) keys.forEach(k => existingMap.set(k, { id: data.id, record: safeRow }));
            setRecentLog(p => [{ name: row.full_name, ok: true }, ...p].slice(0, 15));
          }
        }
        if (i % 5 === 0 || i === valid.length - 1) {
          setProgress({ done: i + 1, total: valid.length });
          setResult({ inserted, updated, skipped, failed: errors.length, total: i + 1 + localErrors.length, errors: errors.slice(0, 500) });
        }
      }
      setProgress({ done: valid.length, total: valid.length });
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
    () => TARGETS.filter(t => enabled[t.key] && mapping[t.key]).length,
    [enabled, mapping]
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
                  {headers.length} عمود · {rows.length} صف · مفعّل: {mappedCount}
                </span>
              )}
              {rows.length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearDraft} className="text-destructive">
                  مسح المسودة
                </Button>
              )}
              <div className="flex items-center gap-2 ms-auto">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Switch checked={skipDuplicates} onCheckedChange={setSkipDuplicates} />
                  <span>مطابقة المكرر — يحدّث تاريخ/وقت التقديم فقط ولا يدمج باقي البيانات</span>
                </label>
              </div>
            </div>

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
                : `حفظ ${rows.length} صف شخص بشخص`}
            </Button>
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
};

export default ApplicantsMappedImport;
