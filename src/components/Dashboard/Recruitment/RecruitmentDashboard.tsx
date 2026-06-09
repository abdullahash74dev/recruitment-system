import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Briefcase, Users, Target, TrendingUp, Plus, Trash2, Pencil, Upload, Download, Filter, BarChart3, FolderOpen, Share2, Copy, Eye, Printer, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend } from "recharts";
import * as XLSX from "xlsx";
import AiImportRecruitment from "./AiImportRecruitment";

const STATUSES = ["new","interviewed","selected","offer_sent","offer_signed","offer_accepted","hired","started","rejected"] as const;
type RStatus = typeof STATUSES[number];

const STATUS_LABELS: Record<RStatus, { ar: string; en: string; color: string }> = {
  new: { ar: "جديد", en: "New", color: "bg-blue-100 text-blue-800" },
  interviewed: { ar: "تمت المقابلة", en: "Interviewed", color: "bg-purple-100 text-purple-800" },
  selected: { ar: "مقبول مبدئياً", en: "Accepted", color: "bg-indigo-100 text-indigo-800" },
  offer_sent: { ar: "تم إرسال العرض", en: "Offer Sent", color: "bg-cyan-100 text-cyan-800" },
  offer_signed: { ar: "تم توقيع العرض", en: "Offer Signed", color: "bg-teal-100 text-teal-800" },
  offer_accepted: { ar: "قبل العرض", en: "Offer Accepted", color: "bg-amber-100 text-amber-800" },
  hired: { ar: "تم التوظيف", en: "Hired", color: "bg-emerald-100 text-emerald-800" },
  started: { ar: "باشر العمل", en: "Started", color: "bg-green-100 text-green-800" },
  rejected: { ar: "مرفوض", en: "Rejected", color: "bg-red-100 text-red-800" },
};

const IMPORT_COLUMNS = ["project_code","job_title_ar","candidate_name","nationality","phone","email","status","rejected_reason","interview_date","hire_date","offer_sent_date","offer_signed_date","expected_start_date","actual_start_date","batch_label","cv_url","notes"];

export default function RecruitmentDashboard() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [projects, setProjects] = useState<any[]>([]);
  const [jobTitles, setJobTitles] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [shareLinks, setShareLinks] = useState<any[]>([]);
  const [autoOpenPrefsId, setAutoOpenPrefsId] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"bar"|"pie"|"donut"|"line"|"area">("bar");
  const [loading, setLoading] = useState(true);

  // filters
  const [fProject, setFProject] = useState("all");
  const [fJob, setFJob] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fSearch, setFSearch] = useState("");

  // dialogs
  const [projectDialog, setProjectDialog] = useState<any>(null);
  const [jobDialog, setJobDialog] = useState<any>(null);
  const [candDialog, setCandDialog] = useState<any>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; reason_id: string; note: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [strictExisting, setStrictExisting] = useState(false);
  const [perJobImport, setPerJobImport] = useState<{ project_id: string; job_title_id: string } | null>(null);
  const perJobFileRef = useRef<HTMLInputElement>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [p, j, c, s, r, sl] = await Promise.all([
      supabase.from("recruitment_projects").select("*").order("created_at", { ascending: false }),
      supabase.from("recruitment_job_titles").select("*").order("created_at", { ascending: false }),
      supabase.from("recruitment_candidates").select("*").order("created_at", { ascending: false }),
      supabase.from("recruitment_job_title_stats").select("*"),
      supabase.from("rejection_reasons").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("executive_share_links").select("*").order("created_at", { ascending: false }),
    ]);
    if (p.data) setProjects(p.data);
    if (j.data) setJobTitles(j.data);
    if (c.data) setCandidates(c.data);
    if (s.data) setStats(s.data);
    if (r.data) setReasons(r.data);
    if (sl.data) setShareLinks(sl.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // realtime
  useEffect(() => {
    const ch = supabase.channel("recruitment-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "recruitment_candidates" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "recruitment_job_titles" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const jobMap = useMemo(() => new Map(jobTitles.map(j => [j.id, j])), [jobTitles]);
  const reasonMap = useMemo(() => new Map(reasons.map(r => [r.id, r])), [reasons]);

  // KPIs
  const kpi = useMemo(() => {
    const totalTarget = stats.reduce((a, s) => a + (s.target_headcount || 0), 0);
    const totalHired = stats.reduce((a, s) => a + Number(s.hired_count || 0), 0);
    const interviewed = stats.reduce((a, s) => a + Number(s.interviewed_count || 0), 0);
    const awaiting = stats.reduce((a, s) => a + Number(s.awaiting_count || 0), 0);
    const rejected = stats.reduce((a, s) => a + Number(s.rejected_count || 0), 0);
    return { totalTarget, totalHired, openVacancies: Math.max(totalTarget - totalHired, 0), interviewed, awaiting, rejected };
  }, [stats]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      if (fProject !== "all" && c.project_id !== fProject) return false;
      if (fJob !== "all" && c.job_title_id !== fJob) return false;
      if (fStatus !== "all" && c.status !== fStatus) return false;
      if (fSearch && !`${c.full_name} ${c.email||""} ${c.phone||""}`.toLowerCase().includes(fSearch.toLowerCase())) return false;
      return true;
    });
  }, [candidates, fProject, fJob, fStatus, fSearch]);

  const rejectionChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    candidates.filter(c => c.status === "rejected" && c.rejected_reason_id).forEach(c => {
      const r = reasonMap.get(c.rejected_reason_id);
      const name = r ? (ar ? r.reason_ar : (r.reason_en || r.reason_ar)) : "—";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [candidates, reasonMap, ar]);

  // ==== Project CRUD ====
  const saveProject = async () => {
    const p = projectDialog;
    if (!p.code || !p.name_ar) { toast.error(ar ? "الرمز والاسم مطلوبان" : "Code & name required"); return; }
    const payload = { code: p.code, name_ar: p.name_ar, name_en: p.name_en || null, notes: p.notes || null, is_active: p.is_active ?? true };
    const op = p.id ? supabase.from("recruitment_projects").update(payload).eq("id", p.id) : supabase.from("recruitment_projects").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(ar ? "تم الحفظ" : "Saved");
    setProjectDialog(null);
    fetchAll();
  };

  const deleteProject = async (id: string) => {
    if (!confirm(ar ? "حذف المشروع؟ سيتم حذف الوظائف المرتبطة." : "Delete project?")) return;
    const { error } = await supabase.from("recruitment_projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    fetchAll();
  };

  // ==== Job Title CRUD ====
  const saveJob = async () => {
    const j = jobDialog;
    if (!j.project_id || !j.title_ar) { toast.error(ar ? "المشروع والاسم مطلوبان" : "Project & title required"); return; }
    const payload = {
      project_id: j.project_id, title_ar: j.title_ar, title_en: j.title_en || null,
      requirements_ar: j.requirements_ar || null, requirements_en: j.requirements_en || null,
      nationality_required: j.nationality_required || null, location: j.location || null,
      job_type: j.job_type || "دوام كامل", salary_range: j.salary_range || null,
      target_headcount: Number(j.target_headcount) || 1,
      is_published_to_board: j.is_published_to_board ?? true, is_active: j.is_active ?? true,
    };
    const op = j.id ? supabase.from("recruitment_job_titles").update(payload).eq("id", j.id) : supabase.from("recruitment_job_titles").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(ar ? "تم الحفظ" : "Saved");
    setJobDialog(null);
    fetchAll();
  };

  const deleteJob = async (id: string) => {
    if (!confirm(ar ? "حذف الوظيفة؟" : "Delete job title?")) return;
    const { error } = await supabase.from("recruitment_job_titles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    fetchAll();
  };

  // ==== Candidate CRUD ====
  const saveCandidate = async () => {
    const c = candDialog;
    if (!c.project_id || !c.job_title_id || !c.full_name) { toast.error(ar ? "حقول مطلوبة ناقصة" : "Required fields missing"); return; }
    if (c.status === "rejected" && !c.rejected_reason_id) { toast.error(ar ? "سبب الرفض مطلوب" : "Rejection reason required"); return; }
    const payload = {
      project_id: c.project_id, job_title_id: c.job_title_id, full_name: c.full_name,
      nationality: c.nationality || null, phone: c.phone || null, email: c.email || null,
      cv_url: c.cv_url || null, status: c.status || "new",
      rejected_reason_id: c.status === "rejected" ? c.rejected_reason_id : null,
      rejected_note: c.rejected_note || null,
      interview_date: c.interview_date || null, hire_date: c.hire_date || null,
      offer_sent_date: c.offer_sent_date || null, offer_signed_date: c.offer_signed_date || null,
      expected_start_date: c.expected_start_date || null, actual_start_date: c.actual_start_date || null,
      batch_label: c.batch_label || null,
      notes: c.notes || null,
    };
    const op = c.id ? supabase.from("recruitment_candidates").update(payload).eq("id", c.id) : supabase.from("recruitment_candidates").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(ar ? "تم الحفظ" : "Saved");
    setCandDialog(null);
    fetchAll();
  };

  const deleteCandidate = async (id: string) => {
    if (!confirm(ar ? "حذف المرشح؟" : "Delete candidate?")) return;
    const { error } = await supabase.from("recruitment_candidates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    fetchAll();
  };

  const changeStatus = async (cand: any, newStatus: RStatus) => {
    if (newStatus === "rejected") {
      setRejectDialog({ id: cand.id, reason_id: "", note: "" });
      return;
    }
    const today = new Date().toISOString().slice(0,10);
    const updates: any = { status: newStatus };
    if (newStatus === "interviewed" && !cand.interview_date) updates.interview_date = today;
    if (newStatus === "offer_sent" && !cand.offer_sent_date) updates.offer_sent_date = today;
    if (newStatus === "offer_signed" && !cand.offer_signed_date) updates.offer_signed_date = today;
    if (newStatus === "hired" && !cand.hire_date) updates.hire_date = today;
    if (newStatus === "started" && !cand.actual_start_date) updates.actual_start_date = today;
    const { error } = await supabase.from("recruitment_candidates").update(updates).eq("id", cand.id);
    if (error) return toast.error(error.message);
  };

  const confirmReject = async () => {
    if (!rejectDialog?.reason_id) { toast.error(ar ? "اختر السبب" : "Select reason"); return; }
    const { error } = await supabase.from("recruitment_candidates").update({
      status: "rejected", rejected_reason_id: rejectDialog.reason_id, rejected_note: rejectDialog.note || null,
    }).eq("id", rejectDialog.id);
    if (error) return toast.error(error.message);
    setRejectDialog(null);
  };

  // ==== Import (multi-sheet workbook) ====
  const PROJECT_COLS = ["code","name_ar","name_en","notes"];
  const JOB_COLS = ["project_code","title_ar","title_en","target_headcount","nationality_required","location","job_type","salary_range","requirements_ar","requirements_en","is_published_to_board"];

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const projSample = [{ code: "PRJ-001", name_ar: "مشروع الرياض", name_en: "Riyadh Project", notes: "" }];
    const wsP = XLSX.utils.json_to_sheet(projSample, { header: PROJECT_COLS });
    XLSX.utils.book_append_sheet(wb, wsP, "Projects");

    const jobSample = [
      { project_code: "PRJ-001", title_ar: "محاسب", title_en: "Accountant", target_headcount: 5, nationality_required: "سعودي", location: "الرياض", job_type: "دوام كامل", salary_range: "5000-8000", requirements_ar: "خبرة 3 سنوات", requirements_en: "3 years exp", is_published_to_board: "true" },
      { project_code: "PRJ-001", title_ar: "مهندس مدني", title_en: "Civil Engineer", target_headcount: 3, nationality_required: "", location: "", job_type: "دوام كامل", salary_range: "", requirements_ar: "", requirements_en: "", is_published_to_board: "true" },
    ];
    const wsJ = XLSX.utils.json_to_sheet(jobSample, { header: JOB_COLS });
    XLSX.utils.book_append_sheet(wb, wsJ, "JobTitles");

    const candSample = [{ project_code: "PRJ-001", job_title_ar: "محاسب", candidate_name: "محمد أحمد", nationality: "سعودي", phone: "0501234567", email: "ex@example.com", status: "new", rejected_reason: "", interview_date: "", hire_date: "", offer_sent_date: "", offer_signed_date: "", expected_start_date: "", actual_start_date: "", batch_label: "مقابلات الأسبوع 1", cv_url: "", notes: "" }];
    const wsC = XLSX.utils.json_to_sheet(candSample, { header: IMPORT_COLUMNS });
    XLSX.utils.book_append_sheet(wb, wsC, "Candidates");

    XLSX.writeFile(wb, "recruitment_import_template.xlsx");
  };

  const sheetToPayload = (wb: XLSX.WorkBook, name: string) => {
    const sheetName = wb.SheetNames.find(n => n.toLowerCase() === name.toLowerCase());
    if (!sheetName) return null;
    const ws = wb.Sheets[sheetName];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
    if (!json.length) return null;
    const headers = (json[0] as any[]).map((h: any) => String(h).trim());
    const rows = (json.slice(1) as any[][]).filter(r => r.some(v => v !== "" && v != null && v !== undefined));
    return { headers, rows };
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      const sheets: any = {};
      const p = sheetToPayload(wb, "Projects"); if (p) sheets.Projects = p;
      const j = sheetToPayload(wb, "JobTitles"); if (j) sheets.JobTitles = j;
      const c = sheetToPayload(wb, "Candidates"); if (c) sheets.Candidates = c;

      // Backward-compat: single-sheet workbook = candidates
      if (!Object.keys(sheets).length) {
        const first = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(first, { defval: "", header: 1 });
        if (json.length < 2) throw new Error(ar ? "الملف فارغ" : "Empty file");
        sheets.Candidates = { headers: (json[0] as any[]).map((h:any)=>String(h).trim()), rows: (json.slice(1) as any[][]).filter(r => r.some(v => v !== "" && v != null)) };
      }

      const { data, error } = await supabase.functions.invoke("import-recruitment", {
        body: { sheets, filename: file.name, strict_existing: strictExisting },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setImportResult(data);

      const totalIns = (data.projects?.inserted||0) + (data.projects?.updated||0)
        + (data.job_titles?.inserted||0) + (data.job_titles?.updated||0)
        + (data.candidates?.inserted||0);
      const totalFail = (data.projects?.failed||0) + (data.job_titles?.failed||0) + (data.candidates?.failed||0);
      if (totalIns > 0) toast.success(ar ? `تم معالجة ${totalIns} سجل` : `Processed ${totalIns} records`);
      if (totalFail > 0) toast.warning(ar ? `${totalFail} مرفوض` : `${totalFail} rejected`);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const PER_JOB_COLS = ["candidate_name","nationality","phone","email","status","rejected_reason","interview_date","hire_date","offer_sent_date","offer_signed_date","expected_start_date","actual_start_date","batch_label","cv_url","notes"];

  const downloadPerJobTemplate = () => {
    if (!perJobImport) return;
    const job = jobMap.get(perJobImport.job_title_id);
    const proj = projectMap.get(perJobImport.project_id);
    const wb = XLSX.utils.book_new();
    const sample = [{ candidate_name: ar?"محمد أحمد":"Mohammed Ahmed", nationality: ar?"سعودي":"Saudi", phone: "0501234567", email: "ex@example.com", status: "new", rejected_reason: "", interview_date: "", hire_date: "", offer_sent_date: "", offer_signed_date: "", expected_start_date: "", actual_start_date: "", batch_label: ar?"مقابلات الأسبوع 1":"Week 1", cv_url: "", notes: "" }];
    const ws = XLSX.utils.json_to_sheet(sample, { header: PER_JOB_COLS });
    XLSX.utils.book_append_sheet(wb, ws, "Candidates");
    const safe = (s: string) => (s||"").replace(/[^\w\u0600-\u06FF]+/g,"_").slice(0,40);
    XLSX.writeFile(wb, `candidates_${safe(proj?.code||"")}_${safe(job?.title_ar||"")}.xlsx`);
  };

  const handlePerJobImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !perJobImport) return;
    setImporting(true); setImportResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames.find(n => n.toLowerCase()==="candidates") || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
      if (json.length < 2) throw new Error(ar ? "الملف فارغ" : "Empty file");
      const headers = (json[0] as any[]).map((h:any)=>String(h).trim());
      const rows = (json.slice(1) as any[][]).filter(r => r.some(v => v !== "" && v != null));
      const { data, error } = await supabase.functions.invoke("import-recruitment", {
        body: {
          sheets: { Candidates: { headers, rows } },
          target_project_id: perJobImport.project_id,
          target_job_title_id: perJobImport.job_title_id,
          filename: file.name,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setImportResult(data);
      const ins = data.candidates?.inserted || 0;
      const fail = data.candidates?.failed || 0;
      if (ins > 0) toast.success(ar ? `تم استيراد ${ins} مرشح` : `Imported ${ins} candidates`);
      if (fail > 0) toast.warning(ar ? `${fail} مرفوض` : `${fail} rejected`);
      fetchAll();
    } catch (err:any) {
      toast.error(err.message);
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
      if (perJobFileRef.current) perJobFileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label={ar?"إجمالي المطلوب":"Total Target"} value={kpi.totalTarget} icon={Target} color="text-primary" />
        <KpiCard label={ar?"تم التوظيف":"Total Hired"} value={kpi.totalHired} icon={Users} color="text-emerald-600" />
        <KpiCard label={ar?"شواغر مفتوحة":"Open Vacancies"} value={kpi.openVacancies} icon={Briefcase} color="text-amber-600" />
        <KpiCard label={ar?"تم المقابلة":"Interviewed"} value={kpi.interviewed} icon={TrendingUp} color="text-purple-600" />
      </div>

      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-2">
          <TabsTrigger value="performance"><BarChart3 className="w-4 h-4 me-1"/>{ar?"الأداء":"Performance"}</TabsTrigger>
          <TabsTrigger value="candidates"><Users className="w-4 h-4 me-1"/>{ar?"المرشحون":"Candidates"}</TabsTrigger>
          <TabsTrigger value="job_titles"><Briefcase className="w-4 h-4 me-1"/>{ar?"الوظائف":"Job Titles"}</TabsTrigger>
          <TabsTrigger value="projects"><FolderOpen className="w-4 h-4 me-1"/>{ar?"المشاريع":"Projects"}</TabsTrigger>
          <TabsTrigger value="import"><Upload className="w-4 h-4 me-1"/>{ar?"الاستيراد":"Import"}</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 me-1"/>{ar?"تحليل الرفض":"Rejection"}</TabsTrigger>
          <TabsTrigger value="executive"><Share2 className="w-4 h-4 me-1"/>{ar?"العرض التنفيذي":"Executive"}</TabsTrigger>
        </TabsList>

        {/* PERFORMANCE */}
        <TabsContent value="performance">
          <Card>
            <CardHeader><CardTitle>{ar?"أداء كل وظيفة":"Job Title Performance"}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar?"المشروع":"Project"}</TableHead>
                    <TableHead>{ar?"الوظيفة":"Job Title"}</TableHead>
                    <TableHead>{ar?"المطلوب":"Target"}</TableHead>
                    <TableHead>{ar?"تم التوظيف":"Hired"}</TableHead>
                    <TableHead>{ar?"المتبقي":"Gap"}</TableHead>
                    <TableHead>{ar?"مقابلات":"Interviewed"}</TableHead>
                    <TableHead>{ar?"بانتظار":"Awaiting"}</TableHead>
                    <TableHead className="w-40">{ar?"% الإنجاز":"% Filled"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map(s => {
                    const pct = s.target_headcount ? Math.min(100, Math.round(Number(s.hired_count)*100/s.target_headcount)) : 0;
                    return (
                      <TableRow key={s.job_title_id}>
                        <TableCell>{ar?s.project_name_ar:(s.project_name_en||s.project_name_ar)}</TableCell>
                        <TableCell className="font-medium">{ar?s.title_ar:(s.title_en||s.title_ar)}</TableCell>
                        <TableCell>{s.target_headcount}</TableCell>
                        <TableCell className="text-emerald-600 font-bold">{s.hired_count}</TableCell>
                        <TableCell className={s.remaining_gap>0?"text-amber-600 font-bold":"text-muted-foreground"}>{s.remaining_gap}</TableCell>
                        <TableCell>{s.interviewed_count}</TableCell>
                        <TableCell>{s.awaiting_count}</TableCell>
                        <TableCell><div className="flex items-center gap-2"><Progress value={pct} className="h-2"/><span className="text-xs">{pct}%</span></div></TableCell>
                      </TableRow>
                    );
                  })}
                  {!stats.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{ar?"لا توجد بيانات":"No data"}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CANDIDATES */}
        <TabsContent value="candidates">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <CardTitle>{ar?"المرشحون":"Candidates"} ({filteredCandidates.length})</CardTitle>
                <div className="flex gap-2">
                  <Button onClick={() => setPerJobImport({ project_id: fProject!=="all"?fProject:"", job_title_id: fJob!=="all"?fJob:"" })} size="sm" variant="outline" className="gap-1"><Upload className="w-4 h-4"/>{ar?"استيراد لوظيفة":"Import for job"}</Button>
                  <Button onClick={() => setCandDialog({ status: "new" })} size="sm" className="gap-1"><Plus className="w-4 h-4"/>{ar?"إضافة":"Add"}</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                <Input placeholder={ar?"بحث...":"Search..."} value={fSearch} onChange={e=>setFSearch(e.target.value)} />
                <Select value={fProject} onValueChange={setFProject}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{ar?"كل المشاريع":"All projects"}</SelectItem>
                    {projects.map(p=><SelectItem key={p.id} value={p.id}>{ar?p.name_ar:(p.name_en||p.name_ar)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fJob} onValueChange={setFJob}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{ar?"كل الوظائف":"All jobs"}</SelectItem>
                    {jobTitles.filter(j=>fProject==="all"||j.project_id===fProject).map(j=><SelectItem key={j.id} value={j.id}>{ar?j.title_ar:(j.title_en||j.title_ar)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{ar?"كل الحالات":"All statuses"}</SelectItem>
                    {STATUSES.map(s=><SelectItem key={s} value={s}>{ar?STATUS_LABELS[s].ar:STATUS_LABELS[s].en}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar?"الاسم":"Name"}</TableHead>
                    <TableHead>{ar?"المشروع":"Project"}</TableHead>
                    <TableHead>{ar?"الوظيفة":"Job"}</TableHead>
                    <TableHead>{ar?"الجنسية":"Nationality"}</TableHead>
                    <TableHead>{ar?"التواصل":"Contact"}</TableHead>
                    <TableHead>{ar?"الحالة":"Status"}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.map(c=>{
                    const proj = projectMap.get(c.project_id);
                    const job = jobMap.get(c.job_title_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.full_name}</TableCell>
                        <TableCell className="text-xs">{proj?(ar?proj.name_ar:(proj.name_en||proj.name_ar)):"—"}</TableCell>
                        <TableCell className="text-xs">{job?(ar?job.title_ar:(job.title_en||job.title_ar)):"—"}</TableCell>
                        <TableCell className="text-xs">{c.nationality||"—"}</TableCell>
                        <TableCell className="text-xs">{c.phone||""}<br/>{c.email||""}</TableCell>
                        <TableCell>
                          <Select value={c.status} onValueChange={(v)=>changeStatus(c, v as RStatus)}>
                            <SelectTrigger className="h-8 w-36"><SelectValue/></SelectTrigger>
                            <SelectContent>
                              {STATUSES.map(s=><SelectItem key={s} value={s}>{ar?STATUS_LABELS[s].ar:STATUS_LABELS[s].en}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={()=>setCandDialog(c)}><Pencil className="w-3.5 h-3.5"/></Button>
                            <Button size="sm" variant="ghost" onClick={()=>deleteCandidate(c.id)}><Trash2 className="w-3.5 h-3.5 text-destructive"/></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!filteredCandidates.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{ar?"لا يوجد":"None"}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* JOB TITLES */}
        <TabsContent value="job_titles">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{ar?"الوظائف المستهدفة":"Target Job Titles"}</CardTitle>
                <Button onClick={()=>setJobDialog({ target_headcount:1, is_published_to_board:true, is_active:true })} size="sm" className="gap-1"><Plus className="w-4 h-4"/>{ar?"إضافة":"Add"}</Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{ar?"المشروع":"Project"}</TableHead>
                  <TableHead>{ar?"الوظيفة":"Title"}</TableHead>
                  <TableHead>{ar?"المطلوب":"Target"}</TableHead>
                  <TableHead>{ar?"منشور":"Published"}</TableHead>
                  <TableHead>{ar?"نشط":"Active"}</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {jobTitles.map(j=>{
                    const proj = projectMap.get(j.project_id);
                    return (
                      <TableRow key={j.id}>
                        <TableCell>{proj?(ar?proj.name_ar:(proj.name_en||proj.name_ar)):"—"}</TableCell>
                        <TableCell className="font-medium">{ar?j.title_ar:(j.title_en||j.title_ar)}</TableCell>
                        <TableCell>{j.target_headcount}</TableCell>
                        <TableCell>{j.is_published_to_board?<Badge>✓</Badge>:<Badge variant="outline">—</Badge>}</TableCell>
                        <TableCell>{j.is_active?<Badge>✓</Badge>:<Badge variant="outline">—</Badge>}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={()=>setJobDialog(j)}><Pencil className="w-3.5 h-3.5"/></Button>
                            <Button size="sm" variant="ghost" onClick={()=>deleteJob(j.id)}><Trash2 className="w-3.5 h-3.5 text-destructive"/></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!jobTitles.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{ar?"لا يوجد":"None"}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PROJECTS */}
        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{ar?"المشاريع":"Projects"}</CardTitle>
                <Button onClick={()=>setProjectDialog({ is_active: true })} size="sm" className="gap-1"><Plus className="w-4 h-4"/>{ar?"إضافة":"Add"}</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{ar?"الرمز":"Code"}</TableHead>
                  <TableHead>{ar?"الاسم":"Name"}</TableHead>
                  <TableHead>{ar?"وظائف":"Jobs"}</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {projects.map(p=>(
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell className="font-medium">{ar?p.name_ar:(p.name_en||p.name_ar)}</TableCell>
                      <TableCell>{jobTitles.filter(j=>j.project_id===p.id).length}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={()=>setProjectDialog(p)}><Pencil className="w-3.5 h-3.5"/></Button>
                          <Button size="sm" variant="ghost" onClick={()=>deleteProject(p.id)}><Trash2 className="w-3.5 h-3.5 text-destructive"/></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!projects.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">{ar?"لا يوجد":"None"}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IMPORT */}
        <TabsContent value="import">
          <Card>
            <CardHeader><CardTitle>{ar?"استيراد شامل (مشاريع + وظائف + مرشحين)":"Bulk Import (Projects + Jobs + Candidates)"}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {ar
                  ? "حمّل القالب الذي يحتوي 3 أوراق: Projects و JobTitles و Candidates. عبّئ ما تريد ثم ارفع الملف. سيتم إنشاء/تحديث المشاريع والمسميات الوظيفية تلقائياً قبل إضافة المرشحين."
                  : "Download the template (3 sheets: Projects, JobTitles, Candidates). Fill what you need and upload. Projects and Job Titles are upserted automatically before candidates are inserted."}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button variant="outline" onClick={downloadTemplate} className="gap-1"><Download className="w-4 h-4"/>{ar?"تحميل القالب":"Download template"}</Button>
                <Button onClick={()=>fileRef.current?.click()} disabled={importing} variant="secondary" className="gap-1"><Upload className="w-4 h-4"/>{importing?(ar?"جاري...":"Importing..."):(ar?"رفع بالقالب":"Upload via template")}</Button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden"/>
                <AiImportRecruitment ar={ar} onImported={fetchAll} />
                <div className="flex items-center gap-2 ms-auto rounded border px-3 py-2 bg-muted/30">
                  <Switch checked={strictExisting} onCheckedChange={setStrictExisting} id="strict-existing" />
                  <Label htmlFor="strict-existing" className="text-xs cursor-pointer">
                    {ar ? "استيراد البيانات الموجودة فقط (عدم إنشاء مشاريع/وظائف جديدة تلقائياً)" : "Import existing only (do not auto-create projects/jobs)"}
                  </Label>
                </div>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <div className="font-semibold flex items-center gap-1 mb-1"><span>✨</span>{ar?"الاستيراد الذكي بالذكاء الاصطناعي":"AI Smart Import"}</div>
                <div className="text-muted-foreground text-xs">
                  {ar
                    ? "ارفع أي ملف اكسل بأي ترتيب أعمدة — سيتم تحليله بالذكاء الاصطناعي، مطابقته مع المشاريع والوظائف المسجلة لديك، وعرض معاينة قبل الإضافة الرسمية."
                    : "Upload any Excel file with any column order — AI will analyze, match against your existing projects/jobs, and show preview before committing."}
                </div>
              </div>
              {importResult && !importResult.error && (
                <div className="space-y-3">
                  {(["projects","job_titles","candidates"] as const).map(key => {
                    const r = importResult[key];
                    if (!r) return null;
                    const labels: Record<string,string> = { projects: ar?"المشاريع":"Projects", job_titles: ar?"الوظائف":"Job Titles", candidates: ar?"المرشحون":"Candidates" };
                    return (
                      <div key={key} className="rounded border p-3">
                        <div className="font-semibold mb-1">{labels[key]}</div>
                        <div className="flex flex-wrap gap-4 text-sm">
                          {"inserted" in r && <span className="text-emerald-600">{ar?"مُضاف":"Inserted"}: <b>{r.inserted}</b></span>}
                          {"updated" in r && <span className="text-blue-600">{ar?"محدّث":"Updated"}: <b>{r.updated||0}</b></span>}
                          <span className="text-destructive">{ar?"مرفوض":"Failed"}: <b>{r.failed}</b></span>
                        </div>
                        {r.errors?.length>0 && (
                          <div className="text-xs max-h-40 overflow-auto mt-2">
                            {r.errors.slice(0,20).map((e:any,i:number)=>(
                              <div key={i} className="border-l-2 border-destructive ps-2 py-0.5">#{e.row} {e.name||""} — <span className="text-destructive">{(e.errors||[]).join(", ")}</span></div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {importResult?.error && <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-wrap">{importResult.error}</div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>{ar?"تحليل أسباب الرفض":"Rejection Reasons Analytics"}</CardTitle>
                <div className="flex gap-2 items-center">
                  <Select value={chartType} onValueChange={(v)=>setChartType(v as any)}>
                    <SelectTrigger className="w-32 h-8"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bar">{ar?"أعمدة":"Bar"}</SelectItem>
                      <SelectItem value="pie">{ar?"دائري":"Pie"}</SelectItem>
                      <SelectItem value="donut">{ar?"دونات":"Donut"}</SelectItem>
                      <SelectItem value="line">{ar?"خطوط":"Line"}</SelectItem>
                      <SelectItem value="area">{ar?"مساحة":"Area"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={()=>window.print()} className="gap-1"><Printer className="w-3.5 h-3.5"/>{ar?"طباعة":"Print"}</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rejectionChartData.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  {chartType === "pie" || chartType === "donut" ? (
                    <PieChart>
                      <Pie data={rejectionChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} innerRadius={chartType==="donut"?60:0} label={(e:any)=>`${e.name}: ${e.value}`}>
                        {rejectionChartData.map((_,i)=><Cell key={i} fill={["#1a365d","#2f855a","#d69e2e","#9f1239","#7c3aed","#0891b2","#ea580c"][i%7]}/>)}
                      </Pie>
                      <Tooltip/><Legend/>
                    </PieChart>
                  ) : chartType === "line" ? (
                    <LineChart data={rejectionChartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis/><Tooltip/><Line type="monotone" dataKey="value" stroke="#1a365d" strokeWidth={2}/></LineChart>
                  ) : chartType === "area" ? (
                    <AreaChart data={rejectionChartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis/><Tooltip/><Area type="monotone" dataKey="value" stroke="#1a365d" fill="#1a365d" fillOpacity={0.5}/></AreaChart>
                  ) : (
                    <BarChart data={rejectionChartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="value" fill="#1a365d"/></BarChart>
                  )}
                </ResponsiveContainer>
              ) : <div className="text-center text-muted-foreground py-8">{ar?"لا توجد بيانات رفض":"No rejection data"}</div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXECUTIVE SHARE */}
        <TabsContent value="executive">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>{ar?"روابط مشاركة العرض التنفيذي":"Executive Dashboard Share Links"}</CardTitle>
                <Button onClick={async () => {
                  const label = prompt(ar?"اسم الرابط (مثال: مدير عام)":"Link label (e.g. CEO)");
                  if (!label) return;
                  const token = crypto.randomUUID().replace(/-/g,"") + crypto.randomUUID().replace(/-/g,"").slice(0,16);
                  const { data: u } = await supabase.auth.getUser();
                  const { data: created, error } = await supabase.from("executive_share_links").insert({
                    token, label, created_by: u.user?.id, created_by_email: u.user?.email,
                  }).select().single();
                  if (error) { toast.error(error.message); return; }
                  toast.success(ar?"تم الإنشاء — اضبط الصلاحيات الآن":"Created — set permissions now");
                  await fetchAll();
                  setAutoOpenPrefsId(created?.id || null);
                }} size="sm" className="gap-1"><Plus className="w-4 h-4"/>{ar?"رابط جديد":"New link"}</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {ar?"كل رابط يعرض تقريراً تفاعلياً للإدارة التنفيذية مع رسوم بيانية متعددة قابلة للطباعة. لا يحتاج المستلم إلى تسجيل دخول.":"Each link opens an interactive executive report with multiple chart types and print/PDF support. No login required."}
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{ar?"الاسم":"Label"}</TableHead>
                  <TableHead>{ar?"المشاهدات":"Views"}</TableHead>
                  <TableHead>{ar?"آخر مشاهدة":"Last viewed"}</TableHead>
                  <TableHead>{ar?"الحالة":"Status"}</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {shareLinks.map(l => {
                    const url = `${window.location.origin}/executive/recruitment/${l.token}`;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.label || "—"}</TableCell>
                        <TableCell>{l.view_count}</TableCell>
                        <TableCell className="text-xs">{l.last_viewed_at ? new Date(l.last_viewed_at).toLocaleString(ar?"ar-SA":"en-US") : "—"}</TableCell>
                        <TableCell>{l.is_active ? <Badge>{ar?"نشط":"Active"}</Badge> : <Badge variant="outline">{ar?"معطّل":"Disabled"}</Badge>}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            <Button size="sm" variant="outline" onClick={()=>{ navigator.clipboard.writeText(url); toast.success(ar?"تم النسخ":"Copied"); }} className="gap-1"><Copy className="w-3.5 h-3.5"/>{ar?"نسخ":"Copy"}</Button>
                            <Button size="sm" variant="outline" onClick={()=>window.open(url,"_blank")} className="gap-1"><Eye className="w-3.5 h-3.5"/>{ar?"عرض":"View"}</Button>
                            <DefaultPrefsPopover link={l} ar={ar} onSaved={fetchAll} autoOpen={autoOpenPrefsId===l.id} onAutoOpened={()=>setAutoOpenPrefsId(null)} />
                            <Button size="sm" variant="outline" onClick={async()=>{
                              await supabase.from("executive_share_links").update({ is_active: !l.is_active }).eq("id", l.id);
                              fetchAll();
                            }}>{l.is_active?(ar?"تعطيل":"Disable"):(ar?"تفعيل":"Enable")}</Button>
                            <Button size="sm" variant="ghost" onClick={async()=>{
                              if (!confirm(ar?"حذف الرابط؟":"Delete link?")) return;
                              await supabase.from("executive_share_links").delete().eq("id", l.id);
                              fetchAll();
                            }}><Trash2 className="w-3.5 h-3.5 text-destructive"/></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!shareLinks.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{ar?"لا توجد روابط":"No links"}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Project Dialog */}
      {projectDialog && (
        <Dialog open onOpenChange={()=>setProjectDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{projectDialog.id?(ar?"تعديل":"Edit"):(ar?"إضافة":"Add")} {ar?"مشروع":"Project"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{ar?"الرمز":"Code"} *</Label><Input value={projectDialog.code||""} onChange={e=>setProjectDialog({...projectDialog,code:e.target.value})}/></div>
              <div><Label>{ar?"الاسم بالعربية":"Arabic name"} *</Label><Input value={projectDialog.name_ar||""} onChange={e=>setProjectDialog({...projectDialog,name_ar:e.target.value})}/></div>
              <div><Label>{ar?"الاسم بالإنجليزية":"English name"}</Label><Input value={projectDialog.name_en||""} onChange={e=>setProjectDialog({...projectDialog,name_en:e.target.value})}/></div>
              <div><Label>{ar?"ملاحظات":"Notes"}</Label><Textarea value={projectDialog.notes||""} onChange={e=>setProjectDialog({...projectDialog,notes:e.target.value})}/></div>
              <div className="flex items-center gap-2"><Switch checked={projectDialog.is_active!==false} onCheckedChange={v=>setProjectDialog({...projectDialog,is_active:v})}/><Label>{ar?"نشط":"Active"}</Label></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setProjectDialog(null)}>{ar?"إلغاء":"Cancel"}</Button><Button onClick={saveProject}>{ar?"حفظ":"Save"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Job Dialog */}
      {jobDialog && (
        <Dialog open onOpenChange={()=>setJobDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{jobDialog.id?(ar?"تعديل":"Edit"):(ar?"إضافة":"Add")} {ar?"وظيفة":"Job Title"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{ar?"المشروع":"Project"} *</Label>
                <Select value={jobDialog.project_id||""} onValueChange={v=>setJobDialog({...jobDialog,project_id:v})}>
                  <SelectTrigger><SelectValue placeholder={ar?"اختر":"Select"}/></SelectTrigger>
                  <SelectContent>{projects.map(p=><SelectItem key={p.id} value={p.id}>{ar?p.name_ar:(p.name_en||p.name_ar)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{ar?"المسمى عربي":"Title AR"} *</Label><Input value={jobDialog.title_ar||""} onChange={e=>setJobDialog({...jobDialog,title_ar:e.target.value})}/></div>
                <div><Label>{ar?"المسمى إنجليزي":"Title EN"}</Label><Input value={jobDialog.title_en||""} onChange={e=>setJobDialog({...jobDialog,title_en:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{ar?"العدد المطلوب":"Target headcount"}</Label><Input type="number" value={jobDialog.target_headcount||1} onChange={e=>setJobDialog({...jobDialog,target_headcount:Number(e.target.value)})}/></div>
                <div><Label>{ar?"نطاق الراتب":"Salary range"}</Label><Input value={jobDialog.salary_range||""} onChange={e=>setJobDialog({...jobDialog,salary_range:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{ar?"الجنسية المطلوبة":"Nationality required"}</Label><Input value={jobDialog.nationality_required||""} onChange={e=>setJobDialog({...jobDialog,nationality_required:e.target.value})}/></div>
                <div><Label>{ar?"الموقع":"Location"}</Label><Input value={jobDialog.location||""} onChange={e=>setJobDialog({...jobDialog,location:e.target.value})}/></div>
              </div>
              <div><Label>{ar?"المتطلبات":"Requirements (AR)"}</Label><Textarea value={jobDialog.requirements_ar||""} onChange={e=>setJobDialog({...jobDialog,requirements_ar:e.target.value})}/></div>
              <div><Label>Requirements (EN)</Label><Textarea value={jobDialog.requirements_en||""} onChange={e=>setJobDialog({...jobDialog,requirements_en:e.target.value})}/></div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2"><Switch checked={jobDialog.is_published_to_board!==false} onCheckedChange={v=>setJobDialog({...jobDialog,is_published_to_board:v})}/><Label>{ar?"نشر في صفحة الوظائف":"Publish to Job Board"}</Label></div>
                <div className="flex items-center gap-2"><Switch checked={jobDialog.is_active!==false} onCheckedChange={v=>setJobDialog({...jobDialog,is_active:v})}/><Label>{ar?"نشط":"Active"}</Label></div>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setJobDialog(null)}>{ar?"إلغاء":"Cancel"}</Button><Button onClick={saveJob}>{ar?"حفظ":"Save"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Candidate Dialog */}
      {candDialog && (
        <Dialog open onOpenChange={()=>setCandDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{candDialog.id?(ar?"تعديل":"Edit"):(ar?"إضافة":"Add")} {ar?"مرشح":"Candidate"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{ar?"المشروع":"Project"} *</Label>
                  <Select value={candDialog.project_id||""} onValueChange={v=>setCandDialog({...candDialog,project_id:v,job_title_id:""})}>
                    <SelectTrigger><SelectValue placeholder={ar?"اختر":"Select"}/></SelectTrigger>
                    <SelectContent>{projects.map(p=><SelectItem key={p.id} value={p.id}>{ar?p.name_ar:(p.name_en||p.name_ar)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{ar?"الوظيفة":"Job Title"} *</Label>
                  <Select value={candDialog.job_title_id||""} onValueChange={v=>setCandDialog({...candDialog,job_title_id:v})}>
                    <SelectTrigger><SelectValue placeholder={ar?"اختر":"Select"}/></SelectTrigger>
                    <SelectContent>{jobTitles.filter(j=>j.project_id===candDialog.project_id).map(j=><SelectItem key={j.id} value={j.id}>{ar?j.title_ar:(j.title_en||j.title_ar)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>{ar?"الاسم":"Full name"} *</Label><Input value={candDialog.full_name||""} onChange={e=>setCandDialog({...candDialog,full_name:e.target.value})}/></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>{ar?"الجنسية":"Nationality"}</Label><Input value={candDialog.nationality||""} onChange={e=>setCandDialog({...candDialog,nationality:e.target.value})}/></div>
                <div><Label>{ar?"الجوال":"Phone"}</Label><Input value={candDialog.phone||""} onChange={e=>setCandDialog({...candDialog,phone:e.target.value})}/></div>
                <div><Label>{ar?"البريد":"Email"}</Label><Input value={candDialog.email||""} onChange={e=>setCandDialog({...candDialog,email:e.target.value})}/></div>
              </div>
              <div><Label>{ar?"رابط السيرة الذاتية":"CV URL"}</Label><Input value={candDialog.cv_url||""} onChange={e=>setCandDialog({...candDialog,cv_url:e.target.value})}/></div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>{ar?"الحالة":"Status"}</Label>
                  <Select value={candDialog.status||"new"} onValueChange={v=>setCandDialog({...candDialog,status:v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{STATUSES.map(s=><SelectItem key={s} value={s}>{ar?STATUS_LABELS[s].ar:STATUS_LABELS[s].en}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{ar?"تاريخ المقابلة":"Interview date"}</Label><Input type="date" value={candDialog.interview_date||""} onChange={e=>setCandDialog({...candDialog,interview_date:e.target.value})}/></div>
                <div><Label>{ar?"وسم الدفعة":"Batch label"}</Label><Input placeholder={ar?"مقابلات هذا الأسبوع":"This week interviews"} value={candDialog.batch_label||""} onChange={e=>setCandDialog({...candDialog,batch_label:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{ar?"تاريخ إرسال العرض":"Offer sent date"}</Label><Input type="date" value={candDialog.offer_sent_date||""} onChange={e=>setCandDialog({...candDialog,offer_sent_date:e.target.value})}/></div>
                <div><Label>{ar?"تاريخ توقيع العرض":"Offer signed date"}</Label><Input type="date" value={candDialog.offer_signed_date||""} onChange={e=>setCandDialog({...candDialog,offer_signed_date:e.target.value})}/></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>{ar?"تاريخ التوظيف":"Hire date"}</Label><Input type="date" value={candDialog.hire_date||""} onChange={e=>setCandDialog({...candDialog,hire_date:e.target.value})}/></div>
                <div><Label>{ar?"تاريخ المباشرة المتوقع":"Expected start"}</Label><Input type="date" value={candDialog.expected_start_date||""} onChange={e=>setCandDialog({...candDialog,expected_start_date:e.target.value})}/></div>
                <div><Label>{ar?"تاريخ المباشرة الفعلي":"Actual start"}</Label><Input type="date" value={candDialog.actual_start_date||""} onChange={e=>setCandDialog({...candDialog,actual_start_date:e.target.value})}/></div>
              </div>
              {candDialog.status === "rejected" && (
                <>
                  <div>
                    <Label>{ar?"سبب الرفض":"Rejection reason"} *</Label>
                    <Select value={candDialog.rejected_reason_id||""} onValueChange={v=>setCandDialog({...candDialog,rejected_reason_id:v})}>
                      <SelectTrigger><SelectValue placeholder={ar?"اختر":"Select"}/></SelectTrigger>
                      <SelectContent>{reasons.map(r=><SelectItem key={r.id} value={r.id}>{ar?r.reason_ar:(r.reason_en||r.reason_ar)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>{ar?"ملاحظة الرفض":"Rejection note"}</Label><Input value={candDialog.rejected_note||""} onChange={e=>setCandDialog({...candDialog,rejected_note:e.target.value})}/></div>
                </>
              )}
              <div><Label>{ar?"ملاحظات":"Notes"}</Label><Textarea value={candDialog.notes||""} onChange={e=>setCandDialog({...candDialog,notes:e.target.value})}/></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setCandDialog(null)}>{ar?"إلغاء":"Cancel"}</Button><Button onClick={saveCandidate}>{ar?"حفظ":"Save"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Per-Job Import Dialog */}
      {perJobImport && (
        <Dialog open onOpenChange={()=>{ setPerJobImport(null); setImportResult(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{ar?"استيراد مرشحين لوظيفة محددة":"Import candidates for a specific job"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {ar?"اختر المشروع والوظيفة، ثم حمّل قالب الاستيراد المخصص لها. لن يحتاج الملف لأعمدة project_code أو job_title_ar — سيتم ربطها تلقائياً.":"Pick the project and job, then download a template tailored to it. The file does not need project_code/job_title_ar columns — they're auto-mapped."}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{ar?"المشروع":"Project"} *</Label>
                  <Select value={perJobImport.project_id} onValueChange={v=>setPerJobImport({ project_id: v, job_title_id: "" })}>
                    <SelectTrigger><SelectValue placeholder={ar?"اختر":"Select"}/></SelectTrigger>
                    <SelectContent>{projects.map(p=><SelectItem key={p.id} value={p.id}>{ar?p.name_ar:(p.name_en||p.name_ar)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{ar?"الوظيفة":"Job Title"} *</Label>
                  <Select value={perJobImport.job_title_id} onValueChange={v=>setPerJobImport({ ...perJobImport, job_title_id: v })} disabled={!perJobImport.project_id}>
                    <SelectTrigger><SelectValue placeholder={ar?"اختر":"Select"}/></SelectTrigger>
                    <SelectContent>{jobTitles.filter(j=>j.project_id===perJobImport.project_id).map(j=><SelectItem key={j.id} value={j.id}>{ar?j.title_ar:(j.title_en||j.title_ar)} ({j.target_headcount})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={downloadPerJobTemplate} disabled={!perJobImport.job_title_id} className="gap-1"><Download className="w-4 h-4"/>{ar?"تحميل القالب":"Download template"}</Button>
                <Button onClick={()=>perJobFileRef.current?.click()} disabled={!perJobImport.job_title_id || importing} className="gap-1"><Upload className="w-4 h-4"/>{importing?(ar?"جاري...":"Importing..."):(ar?"رفع ملف Excel":"Upload Excel")}</Button>
                <input ref={perJobFileRef} type="file" accept=".xlsx,.xls" onChange={handlePerJobImport} className="hidden"/>
              </div>
              {importResult && !importResult.error && importResult.candidates && (
                <div className="rounded border p-3 text-sm space-y-1">
                  <div className="text-emerald-600">{ar?"مُضاف":"Inserted"}: <b>{importResult.candidates.inserted}</b></div>
                  <div className="text-destructive">{ar?"مرفوض":"Failed"}: <b>{importResult.candidates.failed}</b></div>
                  {importResult.candidates.errors?.length>0 && (
                    <div className="text-xs max-h-40 overflow-auto pt-2 border-t mt-2">
                      {importResult.candidates.errors.slice(0,30).map((e:any,i:number)=>(
                        <div key={i} className="border-l-2 border-destructive ps-2 py-0.5">#{e.row} {e.name||""} — <span className="text-destructive">{(e.errors||[]).join(", ")}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {importResult?.error && <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive">{importResult.error}</div>}
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>{ setPerJobImport(null); setImportResult(null); }}>{ar?"إغلاق":"Close"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {rejectDialog && (
        <Dialog open onOpenChange={()=>setRejectDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{ar?"سبب الرفض مطلوب":"Rejection reason required"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{ar?"السبب":"Reason"} *</Label>
                <Select value={rejectDialog.reason_id} onValueChange={v=>setRejectDialog({...rejectDialog,reason_id:v})}>
                  <SelectTrigger><SelectValue placeholder={ar?"اختر":"Select"}/></SelectTrigger>
                  <SelectContent>{reasons.map(r=><SelectItem key={r.id} value={r.id}>{ar?r.reason_ar:(r.reason_en||r.reason_ar)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{ar?"ملاحظة":"Note"}</Label><Input value={rejectDialog.note} onChange={e=>setRejectDialog({...rejectDialog,note:e.target.value})}/></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setRejectDialog(null)}>{ar?"إلغاء":"Cancel"}</Button><Button onClick={confirmReject}>{ar?"تأكيد الرفض":"Confirm reject"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs md:text-sm">{label}</p>
            <p className="text-2xl md:text-3xl font-bold mt-1">{value}</p>
          </div>
          <Icon className={`w-8 h-8 md:w-10 md:h-10 ${color} opacity-80`}/>
        </div>
      </CardContent>
    </Card>
  );
}

const EXEC_KPI_KEYS = ["target","hired","open","interviews","offer_sent","offer_signed","started","rejected"] as const;
const EXEC_SECTION_KEYS = ["fillRate","projectChart","statusChart","projectDetails","jobDetails","accepted","rejectionChart","rejected","batchSummary","monthlyTrend"] as const;
const EXEC_NAME_LIST_KEYS = ["accepted", "rejected"] as const;

function DefaultPrefsPopover({ link, ar, onSaved, autoOpen, onAutoOpened }: { link: any; ar: boolean; onSaved: () => void; autoOpen?: boolean; onAutoOpened?: () => void }) {
  const KPI_LABELS_AR: Record<string,{ar:string;en:string}> = {
    target:{ar:"إجمالي المطلوب",en:"Total Target"}, hired:{ar:"تم التوظيف",en:"Hired"},
    open:{ar:"شواغر مفتوحة",en:"Open"}, interviews:{ar:"مقابلات",en:"Interviews"},
    offer_sent:{ar:"عروض مرسلة",en:"Offers Sent"}, offer_signed:{ar:"عروض موقعة",en:"Offers Signed"},
    started:{ar:"باشروا",en:"Started"}, rejected:{ar:"مرفوضين",en:"Rejected"},
  };
  const SEC_LABELS: Record<string,{ar:string;en:string}> = {
    fillRate:{ar:"نسبة الإشغال",en:"Fill Rate"}, projectChart:{ar:"أداء المشاريع",en:"Project Chart"},
    statusChart:{ar:"توزيع الحالات",en:"Status Chart"}, projectDetails:{ar:"تفصيل المشاريع",en:"Project Details"},
    jobDetails:{ar:"تفصيل الوظائف",en:"Job Details"}, accepted:{ar:"قائمة اسماء المرشحين المقبولين",en:"Accepted candidate name list"},
    rejectionChart:{ar:"أسباب الرفض",en:"Rejection Reasons"}, rejected:{ar:"قائمة اسماء الموظفين المرفوضين",en:"Rejected employee name list"},
    batchSummary:{ar:"الدفعات",en:"Batches"}, monthlyTrend:{ar:"الاتجاه الشهري",en:"Monthly Trend"},
  };
  const dp = link.default_prefs || {};
  const initKpi: Record<string,boolean> = Object.fromEntries(EXEC_KPI_KEYS.map(k => [k, dp.kpiVis?.[k] !== false]));
  const initSec: Record<string,boolean> = Object.fromEntries(EXEC_SECTION_KEYS.map(k => [k, dp.secVis?.[k] !== false]));
  const initLockKpi: Record<string,boolean> = Object.fromEntries(EXEC_KPI_KEYS.map(k => [k, Array.isArray(dp.lockedKpi) && dp.lockedKpi.includes(k)]));
  const initLockSec: Record<string,boolean> = Object.fromEntries(EXEC_SECTION_KEYS.map(k => [k, Array.isArray(dp.lockedSec) && dp.lockedSec.includes(k)]));
  const [kpi, setKpi] = useState<Record<string,boolean>>(initKpi);
  const [sec, setSec] = useState<Record<string,boolean>>(initSec);
  const [lockKpi, setLockKpi] = useState<Record<string,boolean>>(initLockKpi);
  const [lockSec, setLockSec] = useState<Record<string,boolean>>(initLockSec);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set(Array.isArray(dp.hiddenCandidateIds) ? dp.hiddenCandidateIds : []));
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [candSearch, setCandSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => { if (autoOpen) { setOpen(true); onAutoOpened?.(); } }, [autoOpen, onAutoOpened]);

  useEffect(() => {
    if (!open || candidates.length) return;
    supabase.from("recruitment_candidates")
      .select("id, full_name, status, nationality, batch_label")
      .in("status", ["selected","offer_sent","offer_signed","offer_accepted","hired","started","rejected"])
      .order("created_at", { ascending: false })
      .then(({ data }) => setCandidates(data || []));
  }, [open, candidates.length]);

  const save = async () => {
    setBusy(true);
    const finalKpi = { ...kpi };
    const finalSec = { ...sec };
    Object.keys(lockKpi).forEach(k => { if (lockKpi[k]) finalKpi[k] = false; });
    Object.keys(lockSec).forEach(k => { if (lockSec[k]) finalSec[k] = false; });
    const lockedKpiArr = Object.keys(lockKpi).filter(k => lockKpi[k]);
    const lockedSecArr = Object.keys(lockSec).filter(k => lockSec[k]);
    const { error } = await supabase.from("executive_share_links")
      .update({ default_prefs: { ...(dp||{}), kpiVis: finalKpi, secVis: finalSec, lockedKpi: lockedKpiArr, lockedSec: lockedSecArr, hiddenCandidateIds: Array.from(hiddenIds) } })
      .eq("id", link.id);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(ar?"تم حفظ الإعدادات الافتراضية":"Defaults saved"); onSaved(); }
  };


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><Settings2 className="w-3.5 h-3.5"/>{ar?"الصلاحيات والإظهار":"Permissions"}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[70vh] overflow-auto" align="end">
        <ScrollArea className="max-h-[55vh]">
          <div className="space-y-3 p-1">
            <div className="text-xs text-muted-foreground">{ar?"تحكم بما يظهر للمستلم. القفل 🔒 يخفي العنصر نهائياً ولا يستطيع المستلم إظهاره.":"Control what the recipient sees. Lock 🔒 hides the item permanently — the recipient cannot reveal it."}</div>
            <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-muted-foreground px-1">
              <span className="flex-1">{ar?"العنصر":"Item"}</span>
              <span className="w-14 text-center">{ar?"إظهار":"Show"}</span>
              <span className="w-14 text-center">{ar?"قفل":"Lock"}</span>
            </div>
            <div>
              <div className="font-semibold text-sm mb-2">{ar?"بطاقات المؤشرات":"KPI Cards"}</div>
              <div className="space-y-1.5">
                {EXEC_KPI_KEYS.map(k => (
                  <div key={k} className="flex items-center gap-2">
                    <Label className="text-xs flex-1">{ar?KPI_LABELS_AR[k].ar:KPI_LABELS_AR[k].en}</Label>
                    <div className="w-14 flex justify-center">
                      <Checkbox checked={kpi[k] && !lockKpi[k]} disabled={lockKpi[k]} onCheckedChange={(v) => setKpi(s => ({ ...s, [k]: !!v }))} />
                    </div>
                    <div className="w-14 flex justify-center">
                      <Checkbox checked={lockKpi[k]} onCheckedChange={(v) => setLockKpi(s => ({ ...s, [k]: !!v }))} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="font-semibold text-sm mb-2">{ar?"قوائم الاسماء":"Name Lists"}</div>
              <div className="space-y-1.5">
                {EXEC_NAME_LIST_KEYS.map(k => (
                  <div key={k} className="flex items-center gap-2">
                    <Label className="text-xs flex-1">{ar?SEC_LABELS[k].ar:SEC_LABELS[k].en}</Label>
                    <div className="w-14 flex justify-center">
                      <Checkbox checked={sec[k] && !lockSec[k]} disabled={lockSec[k]} onCheckedChange={(v) => setSec(s => ({ ...s, [k]: !!v }))} />
                    </div>
                    <div className="w-14 flex justify-center">
                      <Checkbox checked={lockSec[k]} onCheckedChange={(v) => setLockSec(s => ({ ...s, [k]: !!v }))} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="font-semibold text-sm mb-2">{ar?"أقسام التقرير":"Report Sections"}</div>
              <div className="space-y-1.5">
                {EXEC_SECTION_KEYS.filter(k => !EXEC_NAME_LIST_KEYS.includes(k as any)).map(k => (
                  <div key={k} className="flex items-center gap-2">
                    <Label className="text-xs flex-1">{ar?SEC_LABELS[k].ar:SEC_LABELS[k].en}</Label>
                    <div className="w-14 flex justify-center">
                      <Checkbox checked={sec[k] && !lockSec[k]} disabled={lockSec[k]} onCheckedChange={(v) => setSec(s => ({ ...s, [k]: !!v }))} />
                    </div>
                    <div className="w-14 flex justify-center">
                      <Checkbox checked={lockSec[k]} onCheckedChange={(v) => setLockSec(s => ({ ...s, [k]: !!v }))} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="font-semibold text-sm mb-2 flex items-center justify-between">
                <span>{ar?"إخفاء مرشحين محددين":"Hide specific candidates"}</span>
                <span className="text-[10px] text-muted-foreground">{hiddenIds.size} {ar?"مخفي":"hidden"}</span>
              </div>
              <Input placeholder={ar?"بحث بالاسم...":"Search by name..."} value={candSearch} onChange={e=>setCandSearch(e.target.value)} className="h-8 text-xs mb-2"/>
              <div className="max-h-48 overflow-auto border rounded p-1 space-y-1">
                {candidates
                  .filter(c => !candSearch || c.full_name?.toLowerCase().includes(candSearch.toLowerCase()))
                  .slice(0, 200)
                  .map(c => {
                    const isRej = c.status === "rejected";
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-xs px-1 py-0.5 hover:bg-muted rounded cursor-pointer">
                        <Checkbox checked={hiddenIds.has(c.id)} onCheckedChange={(v)=>{
                          setHiddenIds(prev => { const n = new Set(prev); if (v) n.add(c.id); else n.delete(c.id); return n; });
                        }}/>
                        <span className="flex-1 truncate">{c.full_name}</span>
                        <Badge variant={isRej?"destructive":"secondary"} className="text-[9px] h-4">{isRej?(ar?"مرفوض":"Rejected"):(ar?"مقبول":"Accepted")}</Badge>
                      </label>
                    );
                  })}
                {!candidates.length && <div className="text-xs text-muted-foreground text-center py-3">{ar?"جاري التحميل...":"Loading..."}</div>}
              </div>
            </div>
            <Button size="sm" className="w-full" onClick={save} disabled={busy}>{busy?(ar?"جاري الحفظ...":"Saving..."):(ar?"حفظ":"Save")}</Button>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
