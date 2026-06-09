import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, Upload, FileSpreadsheet, Sparkles, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const COLUMNS = [
  "full_name","gender","nationality","birth_date","marital_status","dependents",
  "phone","email","current_city","has_transport",
  "desired_position","job_type","preferred_city","hear_about",
  "education_level","major","university","graduation_year","gpa","currently_studying",
  "years_experience","currently_employed","current_title","current_tasks","self_summary","other_experience",
  "arabic_level","english_level","other_language","linkedin",
  "facility_management_exp","current_salary","expected_salary","available_date",
  "resume_url","degree_url","experience_cert_url","training_certs_url","other_docs_url",
  "notes","status",
];

const HEADERS_AR: Record<string, string> = {
  full_name: "الاسم الكامل *", gender: "الجنس", nationality: "الجنسية", birth_date: "تاريخ الميلاد (YYYY-MM-DD)",
  marital_status: "الحالة الاجتماعية", dependents: "عدد المعالين", phone: "الجوال", email: "البريد الإلكتروني",
  current_city: "المدينة الحالية", has_transport: "وسيلة نقل", desired_position: "الوظيفة المرغوبة", job_type: "نوع العمل",
  preferred_city: "المدينة المفضلة", hear_about: "كيف سمعت عنا", education_level: "المؤهل العلمي", major: "التخصص",
  university: "الجامعة", graduation_year: "سنة التخرج", gpa: "المعدل", currently_studying: "هل تدرس حالياً",
  years_experience: "سنوات الخبرة", currently_employed: "هل تعمل حالياً", current_title: "المسمى الحالي",
  current_tasks: "المهام الحالية", self_summary: "نبذة عنك", other_experience: "خبرات أخرى",
  arabic_level: "مستوى العربية", english_level: "مستوى الإنجليزية", other_language: "لغات أخرى", linkedin: "LinkedIn",
  facility_management_exp: "خبرة إدارة المرافق", current_salary: "الراتب الحالي", expected_salary: "الراتب المتوقع",
  available_date: "تاريخ الالتحاق", resume_url: "رابط السيرة الذاتية", degree_url: "رابط الشهادة",
  experience_cert_url: "رابط شهادة الخبرة", training_certs_url: "رابط شهادات التدريب", other_docs_url: "روابط أخرى",
  notes: "ملاحظات", status: "الحالة (new/reviewing/...)",
};

interface Props { onChanged: () => void; }

const ApplicantsImport = ({ onChanged }: Props) => {
  const { lang } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [useAi, setUseAi] = useState(true);
  const [downloadAtt, setDownloadAtt] = useState(true);

  const downloadTemplate = () => {
    const headerRow: any = {};
    COLUMNS.forEach(c => { headerRow[c] = HEADERS_AR[c]; });
    const sample: any = {
      full_name: "محمد أحمد", gender: "ذكر", nationality: "سعودي", birth_date: "1995-05-10",
      marital_status: "أعزب", dependents: 0, phone: "0501234567", email: "mohammed@example.com",
      current_city: "الرياض", has_transport: "نعم", desired_position: "محاسب", job_type: "دوام كامل",
      preferred_city: "الرياض", hear_about: "لينكدإن", education_level: "بكالوريوس", major: "محاسبة",
      university: "جامعة الملك سعود", graduation_year: "2018", gpa: "4.5/5", currently_studying: "لا",
      years_experience: "5", currently_employed: "نعم", current_title: "محاسب أول",
      current_tasks: "إعداد القوائم المالية", self_summary: "محاسب بخبرة 5 سنوات", other_experience: "",
      arabic_level: "ممتاز", english_level: "جيد جداً", other_language: "", linkedin: "https://linkedin.com/in/mohammed",
      facility_management_exp: "لا", current_salary: "8000", expected_salary: "10000-12000", available_date: "فوراً",
      resume_url: "https://drive.google.com/file/d/xxx/view", degree_url: "", experience_cert_url: "",
      training_certs_url: "", other_docs_url: "", notes: "", status: "new",
    };
    const ws = XLSX.utils.json_to_sheet([headerRow, sample], { header: COLUMNS });
    ws["!cols"] = COLUMNS.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Applicants");
    XLSX.writeFile(wb, "applicants_import_template.xlsx");
    toast.success(lang === "ar" ? "تم تحميل القالب الرسمي" : "Official template downloaded");
  };

  const triggerImport = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
      if (json.length < 2) throw new Error(lang === "ar" ? "الملف فارغ" : "Empty file");

      const headerKeys = json[0] as string[];
      // First row could be friendly Arabic headers — if so, second row should be the keys; otherwise headers ARE keys
      let dataStart = 1;
      let realHeaders = headerKeys;
      // Detect if the first row matches friendly labels; in that case real keys come from COLUMNS
      const looksLikeFriendly = headerKeys.some(h => Object.values(HEADERS_AR).includes(String(h)));
      if (looksLikeFriendly) {
        realHeaders = COLUMNS;
        dataStart = 1; // we still skip the friendly row only
      }

      const rows: any[] = [];
      for (let i = dataStart; i < json.length; i++) {
        const arr = json[i] as any[];
        if (!arr || arr.every(v => v === "" || v == null)) continue;
        const obj: any = {};
        realHeaders.forEach((k, idx) => { obj[k] = arr[idx] ?? ""; });
        rows.push(obj);
      }

      if (rows.length === 0) throw new Error(lang === "ar" ? "لا توجد صفوف" : "No rows");

      toast.info(lang === "ar" ? `جاري معالجة ${rows.length} صف...` : `Processing ${rows.length} rows...`);

      const { data, error } = await supabase.functions.invoke("import-applicants", {
        body: { headers: realHeaders, rows, useAi, downloadAttachments: downloadAtt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error + (data.expected ? `\nالمتوقع: ${data.expected.join(", ")}` : ""));

      setResult(data);
      if (data.inserted > 0) {
        toast.success(lang === "ar" ? `تم استيراد ${data.inserted} متقدم` : `Imported ${data.inserted} applicants`);
        onChanged();
      }
      if (data.failed > 0) {
        toast.warning(lang === "ar" ? `${data.failed} صف مرفوض - راجع التقرير` : `${data.failed} rows rejected - see report`);
      }
    } catch (err: any) {
      toast.error(err.message);
      setResult({ error: err.message });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadErrorReport = () => {
    if (!result?.errors?.length) return;
    const ws = XLSX.utils.json_to_sheet(result.errors.map((e: any) => ({
      row_number: e.row, full_name: e.name, errors: e.errors.join(" | "),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, `import_errors_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-muted/30">
        <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{lang === "ar" ? "استيراد متقدمين بالجملة:" : "Bulk import applicants:"}</span>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1">
          <Download className="w-3.5 h-3.5" />
          {lang === "ar" ? "تحميل القالب الرسمي" : "Download official template"}
        </Button>
        <Button variant="default" size="sm" onClick={() => setOpen(true)} className="gap-1">
          <Upload className="w-3.5 h-3.5" />
          {lang === "ar" ? "استيراد ذكي" : "Smart import"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />{lang === "ar" ? "استيراد ذكي للمتقدمين" : "Smart Applicant Import"}</DialogTitle>
            <DialogDescription>
              {lang === "ar" ? "يجب أن يكون الملف مطابقاً تماماً للقالب الرسمي. الذكاء الاصطناعي سيتحقق من البيانات ويطبّع الرواتب ويكشف التكرار." : "File must match official template exactly. AI validates, normalizes salaries and detects duplicates."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-amber-50 dark:bg-amber-950/20 text-sm">
              <p className="font-semibold mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" />{lang === "ar" ? "قواعد صارمة" : "Strict rules"}</p>
              <ul className="list-disc ms-5 space-y-0.5 text-muted-foreground">
                <li>{lang === "ar" ? "ترتيب وأسماء الأعمدة يجب أن تطابق القالب 100%" : "Column order & names must match template 100%"}</li>
                <li>{lang === "ar" ? "أي انحراف يُرفض الملف بالكامل" : "Any deviation rejects the file"}</li>
                <li>{lang === "ar" ? "روابط المرفقات يتم تنزيلها للتخزين الداخلي تلقائياً" : "Attachment links auto-downloaded to internal storage"}</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useAi} onChange={e => setUseAi(e.target.checked)} />
                {lang === "ar" ? "تفعيل التحليل بالذكاء الاصطناعي (تحقق + تطبيع رواتب + كشف بيانات مشبوهة)" : "Enable AI analysis (validation + salary normalization + suspicious data detection)"}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={downloadAtt} onChange={e => setDownloadAtt(e.target.checked)} />
                {lang === "ar" ? "تنزيل المرفقات من الروابط لتخزين Lovable Cloud الداخلي" : "Download attachments from links to internal Cloud storage"}
              </label>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadTemplate} className="gap-1 flex-1">
                <Download className="w-4 h-4" />
                {lang === "ar" ? "القالب" : "Template"}
              </Button>
              <Button onClick={triggerImport} disabled={loading} className="gap-1 flex-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {loading ? (lang === "ar" ? "جاري المعالجة..." : "Processing...") : (lang === "ar" ? "اختر الملف وابدأ" : "Choose file & start")}
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
            </div>

            {result && !result.error && (
              <div className="rounded-lg border p-3 space-y-2 max-h-96 overflow-auto">
                <div className="flex items-center justify-between">
                  <div className="flex gap-3 text-sm">
                    <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-4 h-4" />{lang === "ar" ? "تم" : "Inserted"}: <b>{result.inserted}</b></span>
                    <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="w-4 h-4" />{lang === "ar" ? "مرفوض" : "Failed"}: <b>{result.failed}</b></span>
                    <span className="text-muted-foreground">{lang === "ar" ? "الإجمالي" : "Total"}: {result.total}</span>
                  </div>
                  {result.failed > 0 && (
                    <Button size="sm" variant="outline" onClick={downloadErrorReport} className="gap-1">
                      <Download className="w-3.5 h-3.5" />
                      {lang === "ar" ? "تقرير الأخطاء" : "Error report"}
                    </Button>
                  )}
                </div>
                {result.aiInsights && (
                  <div className="rounded bg-primary/5 border-primary/20 border p-2 text-xs">
                    <p className="font-semibold mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" />AI</p>
                    <p>{result.aiInsights}</p>
                  </div>
                )}
                {result.errors?.length > 0 && (
                  <div className="text-xs">
                    <p className="font-semibold mb-1">{lang === "ar" ? "أول 10 أخطاء:" : "First 10 errors:"}</p>
                    <ul className="space-y-1">
                      {result.errors.slice(0, 10).map((e: any, i: number) => (
                        <li key={i} className="border-l-2 border-destructive ps-2">
                          <span className="font-mono">#{e.row}</span> {e.name} — <span className="text-destructive">{e.errors.join(", ")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {result?.error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-wrap">
                {result.error}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ApplicantsImport;
