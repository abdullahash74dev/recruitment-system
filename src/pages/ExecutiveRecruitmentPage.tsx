import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Printer, Target, Users, Briefcase, TrendingUp, AlertTriangle, CheckCircle2, Languages, FileSignature, Send, PlayCircle, Settings2, FileSpreadsheet, Layers, LineChart as LineIcon, Save, EyeOff } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import SiteLogo from "@/components/SiteLogo";

const COLORS = ["#3b82f6", "#22d3ee", "#d69e2e", "#9f1239", "#7c3aed", "#0891b2", "#ea580c", "#0d9488", "#be185d"];
type ChartType = "bar" | "pie" | "donut" | "line" | "area" | "radar" | "stacked";
type Lang = "ar" | "en";

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  new: { ar: "جديد", en: "New" },
  interviewed: { ar: "مقابلة", en: "Interviewed" },
  selected: { ar: "مقبول مبدئياً", en: "Accepted" },
  offer_sent: { ar: "تم إرسال العرض", en: "Offer Sent" },
  offer_signed: { ar: "تم توقيع العرض", en: "Offer Signed" },
  offer_accepted: { ar: "قبل العرض", en: "Offer Accepted" },
  hired: { ar: "موظف", en: "Hired" },
  started: { ar: "باشر العمل", en: "Started" },
  rejected: { ar: "مرفوض", en: "Rejected" },
};

const T = {
  ar: {
    title: "تقرير التوظيف التنفيذي", subtitle: "Executive Recruitment Report",
    loading: "جاري التحميل...", invalidLink: "رابط غير صالح أو منتهي الصلاحية", contactAdmin: "يرجى التواصل مع الإدارة للحصول على رابط جديد.",
    print: "طباعة / PDF", chartType: "نوع الرسم", noData: "لا توجد بيانات",
    totalTarget: "إجمالي المطلوب", totalHired: "تم التوظيف", openVacancies: "شواغر مفتوحة",
    interviews: "مقابلات", offerSent: "عروض مرسلة", offerSigned: "عروض موقعة", started: "باشروا العمل",
    rejected: "مرفوضين", fillRate: "نسبة إشغال الشواغر",
    projectPerf: "أداء المشاريع — المطلوب مقابل الموظف", statusDist: "توزيع المرشحين حسب الحالة",
    projectDetails: "تفصيل المشاريع", jobDetails: "تفصيل الوظائف",
    rejectionReasons: "أسباب الرفض",
    acceptedSummary: "قائمة اسماء المرشحين المقبولين", rejectedDetails: "قائمة اسماء الموظفين المرفوضين",
    batchSummary: "تصنيف الدفعات", monthlyTrend: "اتجاه التوظيف الشهري",
    project: "المشروع", job: "الوظيفة", target: "المطلوب", hired: "موظف", remaining: "المتبقي",
    interviewedCol: "مقابلات", pct: "% الإنجاز", batchCol: "الدفعة", totalCol: "الإجمالي", inProgress: "قيد المعالجة", monthCol: "الشهر",
    name: "الاسم", nationality: "الجنسية", status: "الحالة", batch: "الدفعة", expectedStart: "تاريخ المباشرة المتوقع",
    actualStart: "المباشرة الفعلية", reason: "السبب", note: "ملاحظة",
    chartTypes: { bar: "أعمدة", stacked: "مكدسة", line: "خطوط", area: "مساحة", pie: "دائري", donut: "دونات", radar: "رادار" },
    excel: "تصدير Excel",
    saveDefaults: "حفظ كإعدادات افتراضية",
    savedOk: "تم حفظ الإعدادات الافتراضية للرابط",
    saveFail: "تعذّر الحفظ — يتطلب صلاحية مسؤول",
    footer: "منصة التوظيف الذكية — تقرير سري للعرض التنفيذي",
  },
  en: {
    title: "Executive Recruitment Report", subtitle: "تقرير التوظيف التنفيذي",
    loading: "Loading...", invalidLink: "Invalid or expired link", contactAdmin: "Please contact administration for a new link.",
    print: "Print / PDF", chartType: "Chart type", noData: "No data",
    totalTarget: "Total Target", totalHired: "Hired", openVacancies: "Open Vacancies",
    interviews: "Interviews", offerSent: "Offers Sent", offerSigned: "Offers Signed", started: "Started",
    rejected: "Rejected", fillRate: "Vacancy Fill Rate",
    projectPerf: "Project Performance — Target vs Hired", statusDist: "Candidates by Status",
    projectDetails: "Project Breakdown", jobDetails: "Job Title Breakdown",
    rejectionReasons: "Rejection Reasons",
    acceptedSummary: "Accepted candidate name list", rejectedDetails: "Rejected employee name list",
    batchSummary: "Batch Summary", monthlyTrend: "Monthly Hiring Trend",
    project: "Project", job: "Job Title", target: "Target", hired: "Hired", remaining: "Remaining",
    interviewedCol: "Interviewed", pct: "% Filled", batchCol: "Batch", totalCol: "Total", inProgress: "In Progress", monthCol: "Month",
    name: "Name", nationality: "Nationality", status: "Status", batch: "Batch", expectedStart: "Expected Start",
    actualStart: "Actual Start", reason: "Reason", note: "Note",
    chartTypes: { bar: "Bar", stacked: "Stacked", line: "Line", area: "Area", pie: "Pie", donut: "Donut", radar: "Radar" },
    excel: "Export Excel",
    saveDefaults: "Save as defaults",
    savedOk: "Default preferences saved for this link",
    saveFail: "Save failed — admin access required",
    footer: "NexHire AI — Confidential Executive Report",
  },
};

const KPI_KEYS = ["target","hired","open","interviews","offer_sent","offer_signed","started","rejected"] as const;
const SECTION_KEYS = ["fillRate","projectChart","statusChart","projectDetails","jobDetails","accepted","rejectionChart","rejected","batchSummary","monthlyTrend"] as const;
type KpiKey = typeof KPI_KEYS[number];
type SectionKey = typeof SECTION_KEYS[number];

export default function ExecutiveRecruitmentPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [lang, setLang] = useState<Lang>("ar");
  const t = T[lang];
  const ar = lang === "ar";

  // Customization state (persisted per token)
  const storeKey = `exec-prefs-${token}`;
  const [kpiVis, setKpiVis] = useState<Record<KpiKey, boolean>>(() =>
    Object.fromEntries(KPI_KEYS.map(k => [k, true])) as any);
  const [secVis, setSecVis] = useState<Record<SectionKey, boolean>>(() =>
    Object.fromEntries(SECTION_KEYS.map(k => [k, true])) as any);
  const [hiddenProjects, setHiddenProjects] = useState<string[]>([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [lockedKpi, setLockedKpi] = useState<KpiKey[]>([]);
  const [lockedSec, setLockedSec] = useState<SectionKey[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.kpiVis) setKpiVis((v) => ({ ...v, ...p.kpiVis }));
        if (p.secVis) setSecVis((v) => ({ ...v, ...p.secVis }));
        if (Array.isArray(p.hiddenProjects)) setHiddenProjects(p.hiddenProjects);
      }
    } catch {}
    setPrefsLoaded(true);
  }, [storeKey]);

  useEffect(() => {
    if (!prefsLoaded) return;
    localStorage.setItem(storeKey, JSON.stringify({ kpiVis, secVis, hiddenProjects }));
  }, [kpiVis, secVis, hiddenProjects, storeKey, prefsLoaded]);

  useEffect(() => {
    (async () => {
      if (!token) { setError("Missing token"); setLoading(false); return; }
      const { data, error } = await supabase.rpc("get_executive_recruitment", { p_token: token });
      if (error) setError(error.message);
      else {
        setData(data);
        const dp: any = (data as any)?.default_prefs || {};
        // Locked keys: always enforced, recipient cannot show them
        const lk: KpiKey[] = Array.isArray(dp.lockedKpi) ? dp.lockedKpi.filter((k: any) => (KPI_KEYS as readonly string[]).includes(k)) : [];
        const ls: SectionKey[] = Array.isArray(dp.lockedSec) ? dp.lockedSec.filter((k: any) => (SECTION_KEYS as readonly string[]).includes(k)) : [];
        setLockedKpi(lk); setLockedSec(ls);
        // Apply server defaults only if user has no local prefs yet
        if (!localStorage.getItem(storeKey)) {
          if (dp.kpiVis) setKpiVis((v) => ({ ...v, ...dp.kpiVis }));
          if (dp.secVis) setSecVis((v) => ({ ...v, ...dp.secVis }));
          if (Array.isArray(dp.hiddenProjects)) setHiddenProjects(dp.hiddenProjects);
        }
        // Force-hide locked items regardless of local prefs
        if (lk.length) setKpiVis((v) => { const n = { ...v }; lk.forEach(k => { n[k] = false; }); return n; });
        if (ls.length) setSecVis((v) => { const n = { ...v }; ls.forEach(k => { n[k] = false; }); return n; });
      }
      setLoading(false);
    })();
  }, [token, storeKey]);

  const saveAsDefaults = async () => {
    if (!token) return;
    const { error } = await supabase
      .from("executive_share_links")
      .update({ default_prefs: { kpiVis, secVis, hiddenProjects } as any })
      .eq("token", token);
    if (error) toast.error(t.saveFail);
    else toast.success(t.savedOk);
  };

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const totalsSheet = [[t.totalTarget, totals.total_target||0],[t.totalHired, totals.total_hired||0],[t.openVacancies, openVacancies],[t.interviews, totals.total_interviewed||0],[t.offerSent, totals.total_offer_sent||0],[t.offerSigned, totals.total_offer_signed||0],[t.started, totals.total_started||0],[t.rejected, totals.total_rejected||0],[t.fillRate, fillRate+"%"]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["KPI","Value"], ...totalsSheet]), "KPIs");
    if (filteredProjects.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredProjects), "Projects");
    if ((data.per_job_title||[]).length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.per_job_title), "JobTitles");
    if (filteredAccepted.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredAccepted), "Accepted");
    if (filteredRejected.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredRejected), "Rejected");
    if ((data.per_batch||[]).length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.per_batch), "Batches");
    if ((data.monthly_hires||[]).length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.monthly_hires), "MonthlyHires");
    XLSX.writeFile(wb, `executive_report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const isProjectVisible = (name: string) => !hiddenProjects.includes(name);

  const filteredProjects = useMemo(() => (data?.per_project || []).filter((p: any) =>
    isProjectVisible(p.project_name_ar || p.project_name_en || "—")
  ), [data, hiddenProjects]);

  const filteredJobs = useMemo(() => (data?.per_job_title || []).filter((j: any) =>
    isProjectVisible(j.project_name_ar || j.project_name_en || "—")
  ), [data, hiddenProjects]);

  const filteredAccepted = useMemo(() => (data?.accepted_candidates || []).filter((c: any) =>
    isProjectVisible(c.project_name_ar || c.project_name_en || "—")
  ), [data, hiddenProjects]);

  const filteredRejected = useMemo(() => (data?.rejected_candidates || []).filter((c: any) =>
    isProjectVisible(c.project_name_ar || c.project_name_en || "—")
  ), [data, hiddenProjects]);

  // Recompute totals based on filtered projects
  const totals = useMemo(() => {
    if (!hiddenProjects.length) return data?.totals || {};
    const t = { total_target:0, total_hired:0, total_interviewed:0, total_offer_sent:0, total_offer_signed:0, total_started:0, total_rejected:0 };
    filteredProjects.forEach((p: any) => {
      t.total_target += p.target || 0;
      t.total_hired += p.hired || 0;
      t.total_interviewed += p.interviewed || 0;
    });
    filteredAccepted.forEach((c: any) => {
      if (c.status === "offer_sent") t.total_offer_sent++;
      if (c.status === "offer_signed") t.total_offer_signed++;
      if (c.status === "started") t.total_started++;
    });
    t.total_rejected = filteredRejected.length;
    return t;
  }, [data, hiddenProjects, filteredProjects, filteredAccepted, filteredRejected]);

  const openVacancies = Math.max((totals.total_target || 0) - (totals.total_hired || 0), 0);
  const fillRate = totals.total_target ? Math.round((totals.total_hired || 0) * 100 / totals.total_target) : 0;

  const projectChart = useMemo(() => filteredProjects.map((p: any) => ({
    name: ar ? (p.project_name_ar || p.project_name_en || "—") : (p.project_name_en || p.project_name_ar || "—"),
    target: p.target, hired: p.hired, gap: Math.max(p.target - p.hired, 0), interviewed: p.interviewed,
  })), [filteredProjects, ar]);

  const statusChart = useMemo(() => (data?.per_status || []).map((s: any) => ({
    name: STATUS_LABELS[s.status]?.[lang] || s.status, value: s.value,
  })), [data, lang]);

  const rejectionChart = useMemo(() => (data?.rejection || []).map((r: any) => ({
    name: ar ? r.name : (r.name_en || r.name), value: r.value,
  })), [data, ar]);

  const accepted = filteredAccepted;
  const rejectedList = filteredRejected;

  // Project list for filter (from raw data, not filtered)
  const allProjectNames: string[] = useMemo(() => {
    const set = new Set<string>();
    (data?.per_project || []).forEach((p: any) => set.add(p.project_name_ar || p.project_name_en || "—"));
    return Array.from(set);
  }, [data]);

  const KPI_LABELS: Record<KpiKey, string> = {
    target: t.totalTarget, hired: t.totalHired, open: t.openVacancies, interviews: t.interviews,
    offer_sent: t.offerSent, offer_signed: t.offerSigned, started: t.started, rejected: t.rejected,
  };
  const SECTION_LABELS: Record<SectionKey, string> = {
    fillRate: t.fillRate, projectChart: t.projectPerf, statusChart: t.statusDist,
    projectDetails: t.projectDetails, jobDetails: t.jobDetails, accepted: t.acceptedSummary,
    rejectionChart: t.rejectionReasons, rejected: t.rejectedDetails,
    batchSummary: t.batchSummary, monthlyTrend: t.monthlyTrend,
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">{t.loading}</div>;
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6" dir={ar ? "rtl" : "ltr"}>
      <Card className="max-w-md">
        <CardContent className="p-6 text-center space-y-3">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="text-xl font-bold">{t.invalidLink}</h2>
          <p className="text-sm text-muted-foreground">{t.contactAdmin}</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderChart = (chartData: any[], dataKeys: { key: string; color: string; label: string }[]) => {
    if (!chartData.length) return <div className="text-center text-muted-foreground py-12">{t.noData}</div>;
    switch (chartType) {
      case "pie":
      case "donut":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
              <Pie data={chartData} dataKey={dataKeys[0].key} nameKey="name" cx="50%" cy="50%"
                outerRadius={110} innerRadius={chartType === "donut" ? 60 : 0}
                label={(e: any) => `${e.value}`} labelLine={false}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [v, n]} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Legend />
              {dataKeys.map(d => <Line key={d.key} type="monotone" dataKey={d.key} stroke={d.color} name={d.label} strokeWidth={2} />)}
            </LineChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Legend />
              {dataKeys.map(d => <Area key={d.key} type="monotone" dataKey={d.key} fill={d.color} stroke={d.color} fillOpacity={0.6} name={d.label} />)}
            </AreaChart>
          </ResponsiveContainer>
        );
      case "radar":
        return (
          <ResponsiveContainer width="100%" height={360}>
            <RadarChart data={chartData}>
              <PolarGrid /><PolarAngleAxis dataKey="name" /><PolarRadiusAxis />
              {dataKeys.map(d => <Radar key={d.key} dataKey={d.key} stroke={d.color} fill={d.color} fillOpacity={0.5} name={d.label} />)}
              <Legend /><Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        );
      case "stacked":
        return (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Legend />
              {dataKeys.map(d => <Bar key={d.key} dataKey={d.key} stackId="a" fill={d.color} name={d.label} />)}
            </BarChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Legend />
              {dataKeys.map(d => <Bar key={d.key} dataKey={d.key} fill={d.color} name={d.label} />)}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  const projName = (p: any) => ar ? (p.project_name_ar || p.project_name_en || "—") : (p.project_name_en || p.project_name_ar || "—");
  const jobName = (j: any) => ar ? (j.title_ar || j.title_en || "—") : (j.title_en || j.title_ar || "—");

  return (
    <div dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 print:bg-white">
      <style>{`@media print { .no-print { display: none !important; } .print-break { page-break-before: always; } body { background: white !important; } }`}</style>

      <div className="bg-white border-b shadow-sm print:shadow-none">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <SiteLogo className="h-12" />
            <div>
              <h1 className="text-xl font-bold text-primary">{t.title}</h1>
              <p className="text-xs text-muted-foreground">{t.subtitle} — {new Date().toLocaleDateString(ar ? "ar-SA" : "en-US")}</p>
            </div>
          </div>
          <div className="no-print flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setLang(ar ? "en" : "ar")} className="gap-1">
              <Languages className="w-4 h-4" />{ar ? "English" : "عربي"}
            </Button>
            <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(t.chartTypes) as Array<keyof typeof t.chartTypes>).map(k => (
                  <SelectItem key={k} value={k}>{t.chartTypes[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Customization & Save Defaults removed: branding/customization is admin-only via main dashboard to protect company identity */}

            <Button variant="outline" onClick={exportExcel} className="gap-1"><FileSpreadsheet className="w-4 h-4" />{t.excel}</Button>
            <Button onClick={() => window.print()} className="gap-1"><Printer className="w-4 h-4" />{t.print}</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {kpiVis.target && <KpiCard icon={Target} label={t.totalTarget} value={totals.total_target || 0} color="from-blue-500 to-blue-700" />}
          {kpiVis.hired && <KpiCard icon={Users} label={t.totalHired} value={totals.total_hired || 0} color="from-emerald-500 to-emerald-700" />}
          {kpiVis.open && <KpiCard icon={Briefcase} label={t.openVacancies} value={openVacancies} color="from-amber-500 to-amber-700" />}
          {kpiVis.interviews && <KpiCard icon={TrendingUp} label={t.interviews} value={totals.total_interviewed || 0} color="from-purple-500 to-purple-700" />}
          {kpiVis.offer_sent && <KpiCard icon={Send} label={t.offerSent} value={totals.total_offer_sent || 0} color="from-cyan-500 to-cyan-700" />}
          {kpiVis.offer_signed && <KpiCard icon={FileSignature} label={t.offerSigned} value={totals.total_offer_signed || 0} color="from-teal-500 to-teal-700" />}
          {kpiVis.started && <KpiCard icon={PlayCircle} label={t.started} value={totals.total_started || 0} color="from-green-500 to-green-700" />}
          {kpiVis.rejected && <KpiCard icon={AlertTriangle} label={t.rejected} value={totals.total_rejected || 0} color="from-rose-500 to-rose-700" />}
        </div>

        {/* Fill rate */}
        {secVis.fillRate && (
        <Card>
          <CardHeader><CardTitle>{t.fillRate}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-primary">{fillRate}%</div>
              <Progress value={fillRate} className="flex-1 h-4" />
              <div className="text-sm text-muted-foreground">{totals.total_hired || 0} / {totals.total_target || 0}</div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Project chart */}
        {secVis.projectChart && (
        <Card>
          <CardHeader><CardTitle>{t.projectPerf}</CardTitle></CardHeader>
          <CardContent>
            {renderChart(projectChart, [
              { key: "target", color: "#3b82f6", label: t.target },
              { key: "hired", color: "#22d3ee", label: t.hired },
              { key: "gap", color: "#d69e2e", label: t.remaining },
            ])}
          </CardContent>
        </Card>
        )}

        {/* Status distribution */}
        {secVis.statusChart && (
        <Card className="print-break">
          <CardHeader><CardTitle>{t.statusDist}</CardTitle></CardHeader>
          <CardContent>
            {renderChart(statusChart, [{ key: "value", color: "#3b82f6", label: t.status }])}
          </CardContent>
        </Card>
        )}

        {/* Per project details */}
        {secVis.projectDetails && (
        <Card>
          <CardHeader><CardTitle>{t.projectDetails}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t.project}</TableHead><TableHead>{t.target}</TableHead>
                <TableHead>{t.hired}</TableHead><TableHead>{t.remaining}</TableHead>
                <TableHead>{t.interviewedCol}</TableHead><TableHead>{t.pct}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredProjects.map((p: any, i: number) => {
                  const pct = p.target ? Math.round(p.hired * 100 / p.target) : 0;
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{projName(p)}</TableCell>
                      <TableCell>{p.target}</TableCell>
                      <TableCell className="text-emerald-600 font-bold">{p.hired}</TableCell>
                      <TableCell className={p.target - p.hired > 0 ? "text-amber-600 font-bold" : ""}>{Math.max(p.target - p.hired, 0)}</TableCell>
                      <TableCell>{p.interviewed}</TableCell>
                      <TableCell><div className="flex items-center gap-2"><Progress value={pct} className="h-2 flex-1" /><span className="text-xs">{pct}%</span></div></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        )}

        {/* Job titles details */}
        {secVis.jobDetails && (
        <Card className="print-break">
          <CardHeader><CardTitle>{t.jobDetails}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t.project}</TableHead><TableHead>{t.job}</TableHead>
                <TableHead>{t.target}</TableHead><TableHead>{t.hired}</TableHead><TableHead>{t.remaining}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredJobs.map((j: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{projName(j)}</TableCell>
                    <TableCell className="font-medium">{jobName(j)}</TableCell>
                    <TableCell>{j.target_headcount}</TableCell>
                    <TableCell className="text-emerald-600 font-bold">{j.hired_count}</TableCell>
                    <TableCell className={j.remaining_gap > 0 ? "text-amber-600 font-bold" : ""}>{j.remaining_gap}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        )}

        {/* Accepted candidates */}
        {secVis.accepted && accepted.length > 0 && (
          <Card className="print-break">
            <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" />{t.acceptedSummary} ({accepted.length})
              <Button size="sm" variant="ghost" className="ms-auto no-print gap-1 h-7" onClick={() => setSecVis(s => ({ ...s, accepted: false }))}><EyeOff className="w-3.5 h-3.5" />{ar?"إخفاء":"Hide"}</Button>
            </CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t.name}</TableHead><TableHead>{t.project}</TableHead>
                  <TableHead>{t.job}</TableHead><TableHead>{t.nationality}</TableHead>
                  <TableHead>{t.status}</TableHead><TableHead>{t.batch}</TableHead>
                  <TableHead>{t.expectedStart}</TableHead><TableHead>{t.actualStart}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {accepted.map((c: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.full_name}</TableCell>
                      <TableCell className="text-xs">{projName(c)}</TableCell>
                      <TableCell className="text-xs">{jobName(c)}</TableCell>
                      <TableCell className="text-xs">{c.nationality || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{STATUS_LABELS[c.status]?.[lang] || c.status}</Badge></TableCell>
                      <TableCell className="text-xs">{c.batch_label || "—"}</TableCell>
                      <TableCell className="text-xs">{c.expected_start_date || "—"}</TableCell>
                      <TableCell className="text-xs">{c.actual_start_date || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Rejection chart */}
        {secVis.rejectionChart && rejectionChart.length > 0 && (
          <Card>
            <CardHeader><CardTitle>{t.rejectionReasons}</CardTitle></CardHeader>
            <CardContent>
              {renderChart(rejectionChart, [{ key: "value", color: "#9f1239", label: t.rejected }])}
            </CardContent>
          </Card>
        )}

        {/* Rejected detailed list */}
        {secVis.rejected && rejectedList.length > 0 && (
          <Card className="print-break">
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-rose-600" />{t.rejectedDetails} ({rejectedList.length})
              <Button size="sm" variant="ghost" className="ms-auto no-print gap-1 h-7" onClick={() => setSecVis(s => ({ ...s, rejected: false }))}><EyeOff className="w-3.5 h-3.5" />{ar?"إخفاء":"Hide"}</Button>
            </CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t.name}</TableHead><TableHead>{t.project}</TableHead>
                  <TableHead>{t.job}</TableHead><TableHead>{t.nationality}</TableHead>
                  <TableHead>{t.reason}</TableHead><TableHead>{t.note}</TableHead>
                  <TableHead>{t.batch}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rejectedList.map((c: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.full_name}</TableCell>
                      <TableCell className="text-xs">{projName(c)}</TableCell>
                      <TableCell className="text-xs">{jobName(c)}</TableCell>
                      <TableCell className="text-xs">{c.nationality || "—"}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline" className="border-rose-300 text-rose-700">{ar ? c.reason_ar : (c.reason_en || c.reason_ar)}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.rejected_note || "—"}</TableCell>
                      <TableCell className="text-xs">{c.batch_label || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-xs text-muted-foreground py-6">{t.footer}</div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card className="overflow-hidden">
      <div className={`bg-gradient-to-br ${color} p-3 text-white`}>
        <Icon className="w-6 h-6 opacity-80" />
      </div>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground line-clamp-1">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
