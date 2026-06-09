import { useMemo, useRef, useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, FunnelChart, Funnel, LabelList,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, Line, Legend,
} from "recharts";
import {
  Users, MapPin, DollarSign, GraduationCap, Globe, Briefcase, TrendingUp,
  Building2, Printer, FileDown, Sparkles, Filter, Maximize2, Calendar,
  Target, Award, AlertTriangle, Lightbulb, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  normalizeCity, normalizeNationality, normalizeEducation, normalizeGender,
  isSaudi, parseSalary, groupByNormalized,
} from "@/lib/analyticsNormalize";
import { supabase } from "@/integrations/supabase/client";
import { useValueSynonyms } from "@/hooks/useValueSynonyms";
import { toast } from "sonner";
import DashboardCustomizer from "./DashboardCustomizer";
import { useDashboardPrefs, ChartType, DashboardPrefs } from "@/hooks/useDashboardPrefs";

const COLORS = ["#1a365d", "#2f855a", "#3b82f6", "#eab308", "#a855f7", "#ef4444", "#06b6d4", "#f97316", "#ec4899", "#14b8a6"];
const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
];

interface Applicant {
  id: string;
  full_name: string;
  nationality: string | null;
  current_city: string | null;
  preferred_city: string | null;
  current_salary: string | null;
  expected_salary: string | null;
  desired_position: string | null;
  education_level: string | null;
  gender: string | null;
  years_experience: string | null;
  status: string;
  created_at: string;
  job_type: string | null;
  major: string | null;
  marital_status: string | null;
}

interface JobPosting {
  id: string;
  title_ar: string;
  title_en: string | null;
  is_active: boolean;
  created_at: string;
  vacancy_count: number;
  posting_category?: string;
}

interface Props {
  applicants: Applicant[];
  jobs?: JobPosting[];
}

const AnalyticsHub = ({ applicants, jobs = [] }: Props) => {
  const { lang } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);
  const { prefs } = useDashboardPrefs();

  // -------- Filters --------
  const [period, setPeriod] = useState<"all" | "30d" | "90d" | "ytd" | "custom">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [natFilter, setNatFilter] = useState<string>("all");
  const [presentationMode, setPresentationMode] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // -------- Apply filters --------
  const filtered = useMemo(() => {
    let arr = applicants;
    const now = new Date();
    if (period !== "all" && period !== "custom") {
      const cutoff = new Date(now);
      if (period === "30d") cutoff.setDate(now.getDate() - 30);
      if (period === "90d") cutoff.setDate(now.getDate() - 90);
      if (period === "ytd") { cutoff.setMonth(0); cutoff.setDate(1); }
      arr = arr.filter(a => new Date(a.created_at) >= cutoff);
    }
    if (period === "custom" && fromDate && toDate) {
      const f = new Date(fromDate); const t = new Date(toDate); t.setHours(23, 59, 59);
      arr = arr.filter(a => { const d = new Date(a.created_at); return d >= f && d <= t; });
    }
    if (statusFilter !== "all") arr = arr.filter(a => a.status === statusFilter);
    if (natFilter === "saudi") arr = arr.filter(a => isSaudi(a.nationality));
    if (natFilter === "non_saudi") arr = arr.filter(a => !isSaudi(a.nationality));
    return arr;
  }, [applicants, period, fromDate, toDate, statusFilter, natFilter]);

  // Previous period for comparison
  const previousPeriod = useMemo(() => {
    if (period === "all" || period === "custom") return [];
    const days = period === "30d" ? 30 : period === "90d" ? 90 : 365;
    const cutoffEnd = new Date(); cutoffEnd.setDate(cutoffEnd.getDate() - days);
    const cutoffStart = new Date(cutoffEnd); cutoffStart.setDate(cutoffEnd.getDate() - days);
    return applicants.filter(a => {
      const d = new Date(a.created_at);
      return d >= cutoffStart && d < cutoffEnd;
    });
  }, [applicants, period]);

  // Load DB synonyms so normalizers can use them
  const { rows: synRows } = useValueSynonyms();
  const synKey = synRows.length;

  // -------- Computations --------
  const nationalityData = useMemo(() => groupByNormalized(filtered, a => a.nationality, normalizeNationality, lang, 10), [filtered, lang, synKey]);
  const cityData = useMemo(() => groupByNormalized(filtered, a => a.current_city, normalizeCity, lang, 10), [filtered, lang, synKey]);
  const preferredCityData = useMemo(() => groupByNormalized(filtered, a => a.preferred_city, normalizeCity, lang, 10), [filtered, lang, synKey]);
  const educationData = useMemo(() => groupByNormalized(filtered, a => a.education_level, normalizeEducation, lang), [filtered, lang, synKey]);
  const genderData = useMemo(() => groupByNormalized(filtered, a => a.gender, normalizeGender, lang), [filtered, lang, synKey]);
  const majorData = useMemo(() => groupByNormalized(filtered, a => a.major, (v) => v || (lang === "ar" ? "غير محدد" : "Unspecified"), lang, 10), [filtered, lang]);
  const experienceData = useMemo(() => groupByNormalized(filtered, a => a.years_experience, (v) => v || (lang === "ar" ? "غير محدد" : "Unspecified"), lang, 8), [filtered, lang]);
  const jobTypeData = useMemo(() => groupByNormalized(filtered, a => a.job_type, (v) => v || (lang === "ar" ? "غير محدد" : "Unspecified"), lang, 8), [filtered, lang]);


  const saudiCount = useMemo(() => filtered.filter(a => isSaudi(a.nationality)).length, [filtered]);
  const nonSaudiCount = filtered.length - saudiCount;
  const saudizationRate = filtered.length > 0 ? Math.round((saudiCount / filtered.length) * 100) : 0;

  const prevSaudization = useMemo(() => {
    if (previousPeriod.length === 0) return null;
    const ps = previousPeriod.filter(a => isSaudi(a.nationality)).length;
    return Math.round((ps / previousPeriod.length) * 100);
  }, [previousPeriod]);

  // Funnel
  const funnelData = useMemo(() => {
    const counts = {
      new: filtered.filter(a => a.status === "new").length,
      reviewing: filtered.filter(a => ["reviewing", "phone_interview", "in_person_interview", "accepted", "hired"].includes(a.status)).length,
      interview: filtered.filter(a => ["phone_interview", "in_person_interview", "accepted", "hired"].includes(a.status)).length,
      offer: filtered.filter(a => ["accepted", "hired"].includes(a.status)).length,
      hired: filtered.filter(a => a.status === "hired").length,
    };
    return [
      { name: lang === "ar" ? "تقديم" : "Applied", value: filtered.length, fill: COLORS[0] },
      { name: lang === "ar" ? "مراجعة" : "Reviewed", value: counts.reviewing, fill: COLORS[2] },
      { name: lang === "ar" ? "مقابلة" : "Interview", value: counts.interview, fill: COLORS[3] },
      { name: lang === "ar" ? "عرض" : "Offer", value: counts.offer, fill: COLORS[4] },
      { name: lang === "ar" ? "توظيف" : "Hired", value: counts.hired, fill: COLORS[1] },
    ].filter(d => d.value > 0);
  }, [filtered, lang]);

  const conversionRate = filtered.length > 0 ? ((funnelData.find(f => f.name.includes("توظيف") || f.name.includes("Hired"))?.value || 0) / filtered.length * 100).toFixed(1) : "0";

  // Daily trend
  const dailyTrend = useMemo(() => {
    const days: Record<string, { count: number; saudi: number }> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      days[d.toISOString().split("T")[0]] = { count: 0, saudi: 0 };
    }
    applicants.forEach(a => {
      const day = a.created_at.split("T")[0];
      if (day in days) {
        days[day].count++;
        if (isSaudi(a.nationality)) days[day].saudi++;
      }
    });
    return Object.entries(days).map(([date, v]) => ({
      date: new Date(date).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { day: "numeric", month: "short" }),
      total: v.count, saudi: v.saudi,
    }));
  }, [applicants, lang]);

  // Heatmap-style city density
  const cityHeatmap = useMemo(() => cityData.slice(0, 12), [cityData]);
  const maxCity = Math.max(...cityHeatmap.map(c => c.value), 1);

  // Salary by position
  const salaryByPosition = useMemo(() => {
    const posMap: Record<string, { total: number; count: number }> = {};
    filtered.forEach(a => {
      if (!a.desired_position) return;
      const sal = parseSalary(a.expected_salary);
      if (sal === 0) return;
      if (!posMap[a.desired_position]) posMap[a.desired_position] = { total: 0, count: 0 };
      posMap[a.desired_position].total += sal;
      posMap[a.desired_position].count += 1;
    });
    return Object.entries(posMap)
      .map(([name, v]) => ({ name: name.substring(0, 25), avg: Math.round(v.total / v.count), applicants: v.count }))
      .sort((a, b) => b.applicants - a.applicants)
      .slice(0, 10);
  }, [filtered]);

  // Jobs vs applicants
  const jobsAnalysis = useMemo(() => {
    return jobs.filter(j => j.is_active).map(j => {
      const matched = filtered.filter(a => a.desired_position && (
        a.desired_position.toLowerCase().includes((j.title_ar || "").toLowerCase()) ||
        a.desired_position.toLowerCase().includes((j.title_en || "").toLowerCase())
      )).length;
      return {
        name: lang === "ar" ? j.title_ar : (j.title_en || j.title_ar),
        applicants: matched,
        vacancies: j.vacancy_count,
        ratio: j.vacancy_count > 0 ? Math.round((matched / j.vacancy_count) * 10) / 10 : 0,
      };
    }).sort((a, b) => b.applicants - a.applicants).slice(0, 10);
  }, [jobs, filtered, lang]);

  const stats = useMemo(() => {
    const totalPositions = new Set(filtered.map(a => a.desired_position).filter(Boolean)).size;
    const activeJobs = jobs.filter(j => j.is_active).length;
    const totalVacancies = jobs.filter(j => j.is_active).reduce((s, j) => s + j.vacancy_count, 0);
    const expectedVals = filtered.map(a => parseSalary(a.expected_salary)).filter(n => n > 0);
    const currentVals = filtered.map(a => parseSalary(a.current_salary)).filter(n => n > 0);
    const avgSalary = expectedVals.length > 0 ? Math.round(expectedVals.reduce((s, v) => s + v, 0) / expectedVals.length) : 0;
    const avgCurrentSalary = currentVals.length > 0 ? Math.round(currentVals.reduce((s, v) => s + v, 0) / currentVals.length) : 0;
    const totalExpectedPayroll = expectedVals.reduce((s, v) => s + v, 0);
    const totalCurrentPayroll = currentVals.reduce((s, v) => s + v, 0);
    // Estimated annual budget for active vacancies = avg expected salary * vacancies * 12
    const estimatedAnnualBudget = avgSalary * totalVacancies * 12;
    return { totalPositions, activeJobs, totalVacancies, avgSalary, avgCurrentSalary, totalExpectedPayroll, totalCurrentPayroll, estimatedAnnualBudget };
  }, [filtered, jobs]);

  // Period comparison
  const periodChange = useMemo(() => {
    if (previousPeriod.length === 0) return null;
    const change = filtered.length - previousPeriod.length;
    const pct = previousPeriod.length > 0 ? Math.round((change / previousPeriod.length) * 100) : 0;
    return { change, pct };
  }, [filtered, previousPeriod]);

  // -------- Actions --------
  const handlePrint = () => window.print();

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const sheets: Record<string, any[]> = {
      [lang === "ar" ? "الجنسيات" : "Nationalities"]: nationalityData,
      [lang === "ar" ? "المدن" : "Cities"]: cityData,
      [lang === "ar" ? "المؤهلات" : "Education"]: educationData,
      [lang === "ar" ? "الجنس" : "Gender"]: genderData,
      [lang === "ar" ? "الرواتب" : "Salaries"]: salaryByPosition,
      [lang === "ar" ? "الوظائف" : "Jobs"]: jobsAnalysis,
      [lang === "ar" ? "القمع" : "Funnel"]: funnelData,
    };
    Object.entries(sheets).forEach(([n, d]) => {
      if (d.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d), n.substring(0, 31));
    });
    XLSX.writeFile(wb, `analytics_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(lang === "ar" ? "تم التصدير" : "Exported");
  };

  const fetchAiInsights = async () => {
    setAiLoading(true);
    try {
      const payload = {
        total: filtered.length,
        saudization: saudizationRate,
        topNationalities: nationalityData.slice(0, 5),
        topCities: cityData.slice(0, 5),
        education: educationData,
        funnel: funnelData,
        avgSalary: stats.avgSalary,
        conversion: conversionRate,
      };
      const { data, error } = await supabase.functions.invoke("analyze-applicants", { body: { stats: payload, lang } });
      if (error) throw error;
      if (data?.error === "rate_limit") { toast.error(lang === "ar" ? "تجاوزت الحد، حاول لاحقاً" : "Rate limit, try later"); return; }
      if (data?.error === "credits_exhausted") { toast.error(lang === "ar" ? "نفدت الأرصدة" : "AI credits exhausted"); return; }
      setAiInsights(data);
      toast.success(lang === "ar" ? "تم التحليل" : "Insights ready");
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally { setAiLoading(false); }
  };

  // -------- KPI card --------
  const Kpi = ({ icon: Icon, label, value, sub, trend, color }: any) => (
    <Card className="overflow-hidden border-l-4" style={{ borderLeftColor: color }}>
      <CardContent className="p-3 md:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium truncate">{label}</p>
            <p className="text-2xl md:text-3xl font-bold mt-1 leading-tight">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-1 truncate">{sub}</p>}
            {trend !== undefined && trend !== null && (
              <div className={`flex items-center gap-1 mt-1 text-[11px] font-semibold ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(trend)}%
              </div>
            )}
          </div>
          <div className="p-2 rounded-lg shrink-0" style={{ background: `${color}15` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const Body = (
    <div ref={printRef} className={`dashboard-analytics dashboard-theme-${prefs.theme} dashboard-scale-${prefs.scale || "md"} ${prefs.density === "compact" ? "dashboard-compact" : "dashboard-comfortable"} space-y-4`}>
      <div className="dashboard-hero overflow-hidden rounded-xl border bg-card p-4 shadow-elevated print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary/75">{prefs.customEyebrow?.trim() || (lang === "ar" ? "مركز تحكم التوظيف والتحليلات" : "Recruitment Intelligence Center")}</p>
            <h2 className="dashboard-title text-2xl font-extrabold leading-tight md:text-3xl">{prefs.customTitle?.trim() || (lang === "ar" ? "داشبورد تنفيذي احترافي" : "Executive Analytics Dashboard")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{prefs.customSubtitle?.trim() || (lang === "ar" ? "رؤية متكاملة للمتقدمين، السعودة، المدن، الرواتب ومسار التوظيف." : "A complete view of applicants, Saudization, cities, compensation and hiring flow.")}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-background/70 px-3 py-2"><p className="text-[10px] text-muted-foreground">{lang === "ar" ? "المتقدمون" : "Applicants"}</p><p className="text-lg font-black">{filtered.length.toLocaleString()}</p></div>
            <div className="rounded-lg bg-background/70 px-3 py-2"><p className="text-[10px] text-muted-foreground">{lang === "ar" ? "السعودة" : "Saudization"}</p><p className="text-lg font-black">{saudizationRate}%</p></div>
            <div className="rounded-lg bg-background/70 px-3 py-2"><p className="text-[10px] text-muted-foreground">{lang === "ar" ? "الوظائف" : "Jobs"}</p><p className="text-lg font-black">{stats.activeJobs}</p></div>
          </div>
        </div>
      </div>
      {/* Filters bar */}
      <Card className="dashboard-toolbar print:hidden">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "كل الفترة" : "All time"}</SelectItem>
              <SelectItem value="30d">{lang === "ar" ? "آخر 30 يوم" : "Last 30 days"}</SelectItem>
              <SelectItem value="90d">{lang === "ar" ? "آخر 90 يوم" : "Last 90 days"}</SelectItem>
              <SelectItem value="ytd">{lang === "ar" ? "هذه السنة" : "Year to date"}</SelectItem>
              <SelectItem value="custom">{lang === "ar" ? "مخصص" : "Custom"}</SelectItem>
            </SelectContent>
          </Select>
          {period === "custom" && (
            <>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-[140px] h-9" />
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-[140px] h-9" />
            </>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder={lang === "ar" ? "الحالة" : "Status"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "كل الحالات" : "All statuses"}</SelectItem>
              <SelectItem value="new">{lang === "ar" ? "جديد" : "New"}</SelectItem>
              <SelectItem value="reviewing">{lang === "ar" ? "مراجعة" : "Reviewing"}</SelectItem>
              <SelectItem value="phone_interview">{lang === "ar" ? "مقابلة هاتفية" : "Phone interview"}</SelectItem>
              <SelectItem value="in_person_interview">{lang === "ar" ? "مقابلة شخصية" : "In-person"}</SelectItem>
              <SelectItem value="hired">{lang === "ar" ? "تم التوظيف" : "Hired"}</SelectItem>
              <SelectItem value="rejected">{lang === "ar" ? "مرفوض" : "Rejected"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={natFilter} onValueChange={setNatFilter}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "كل الجنسيات" : "All nationalities"}</SelectItem>
              <SelectItem value="saudi">{lang === "ar" ? "سعودي" : "Saudi"}</SelectItem>
              <SelectItem value="non_saudi">{lang === "ar" ? "غير سعودي" : "Non-Saudi"}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={fetchAiInsights} disabled={aiLoading} className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />{aiLoading ? "..." : (lang === "ar" ? "تحليل AI" : "AI Insights")}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5"><FileDown className="w-3.5 h-3.5" />Excel</Button>
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5"><Printer className="w-3.5 h-3.5" />PDF</Button>
          <Button size="sm" variant="outline" onClick={() => setPresentationMode(true)} className="gap-1.5"><Maximize2 className="w-3.5 h-3.5" />{lang === "ar" ? "عرض" : "Present"}</Button>
          <DashboardCustomizer />
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Users} label={lang === "ar" ? "إجمالي المتقدمين" : "Total Applicants"} value={filtered.length.toLocaleString()} trend={periodChange?.pct} color="#1a365d" />
        <Kpi icon={Globe} label={lang === "ar" ? "نسبة السعودة" : "Saudization"} value={`${saudizationRate}%`} sub={`${saudiCount} / ${filtered.length}`} trend={prevSaudization !== null ? saudizationRate - prevSaudization : null} color="#2f855a" />
        <Kpi icon={Target} label={lang === "ar" ? "نسبة التحويل" : "Conversion"} value={`${conversionRate}%`} sub={lang === "ar" ? "تقديم → توظيف" : "Apply → Hire"} color="#a855f7" />
        <Kpi icon={Briefcase} label={lang === "ar" ? "وظائف نشطة" : "Active Jobs"} value={stats.activeJobs} sub={`${stats.totalVacancies} ${lang === "ar" ? "شاغر" : "vacancies"}`} color="#3b82f6" />
        <Kpi icon={DollarSign} label={lang === "ar" ? "متوسط الراتب المتوقع" : "Avg Expected Salary"} value={stats.avgSalary > 0 ? `${(stats.avgSalary / 1000).toFixed(1)}K` : "-"} sub="SAR" color="#eab308" />
        <Kpi icon={MapPin} label={lang === "ar" ? "مدن مغطاة" : "Cities Covered"} value={cityData.length} color="#ef4444" />
      </div>

      {/* Payroll & Budget KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={DollarSign} label={lang === "ar" ? "متوسط الراتب الحالي" : "Avg Current Salary"} value={stats.avgCurrentSalary > 0 ? `${(stats.avgCurrentSalary / 1000).toFixed(1)}K` : "-"} sub="SAR" color="#0ea5e9" />
        <Kpi icon={DollarSign} label={lang === "ar" ? "إجمالي الرواتب المتوقعة" : "Total Expected Payroll"} value={stats.totalExpectedPayroll > 0 ? `${(stats.totalExpectedPayroll / 1000).toFixed(1)}K` : "-"} sub={lang === "ar" ? "ريال/شهر" : "SAR/mo"} color="#16a34a" />
        <Kpi icon={DollarSign} label={lang === "ar" ? "إجمالي الرواتب الحالية" : "Total Current Payroll"} value={stats.totalCurrentPayroll > 0 ? `${(stats.totalCurrentPayroll / 1000).toFixed(1)}K` : "-"} sub={lang === "ar" ? "ريال/شهر" : "SAR/mo"} color="#0891b2" />
        <Kpi icon={DollarSign} label={lang === "ar" ? "ميزانية تقديرية سنوية" : "Est. Annual Budget"} value={stats.estimatedAnnualBudget > 0 ? `${(stats.estimatedAnnualBudget / 1000000).toFixed(2)}M` : "-"} sub={lang === "ar" ? "ريال/سنة" : "SAR/yr"} color="#dc2626" />
      </div>

      {/* AI insights */}
      {aiInsights && (
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />{lang === "ar" ? "رؤى الذكاء الاصطناعي" : "AI-Powered Insights"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {aiInsights.summary && <p className="text-sm font-medium bg-background/60 rounded-md p-3">{aiInsights.summary}</p>}
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              {aiInsights.highlights && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-green-700"><Award className="w-4 h-4" />{lang === "ar" ? "نقاط بارزة" : "Highlights"}</div>
                  <ul className="space-y-1 ps-5 list-disc text-muted-foreground">{aiInsights.highlights.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul>
                </div>
              )}
              {aiInsights.risks && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-red-700"><AlertTriangle className="w-4 h-4" />{lang === "ar" ? "مخاطر" : "Risks"}</div>
                  <ul className="space-y-1 ps-5 list-disc text-muted-foreground">{aiInsights.risks.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul>
                </div>
              )}
              {aiInsights.recommendations && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-blue-700"><Lightbulb className="w-4 h-4" />{lang === "ar" ? "توصيات" : "Recommendations"}</div>
                  <ul className="space-y-1 ps-5 list-disc text-muted-foreground">{aiInsights.recommendations.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul>
                </div>
              )}
              {aiInsights.predictions && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-purple-700"><TrendingUp className="w-4 h-4" />{lang === "ar" ? "توقعات" : "Predictions"}</div>
                  <ul className="space-y-1 ps-5 list-disc text-muted-foreground">{aiInsights.predictions.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview">{lang === "ar" ? "نظرة عامة" : "Overview"}</TabsTrigger>
          <TabsTrigger value="funnel">{lang === "ar" ? "قمع التوظيف" : "Funnel"}</TabsTrigger>
          <TabsTrigger value="geo">{lang === "ar" ? "جغرافي" : "Geographic"}</TabsTrigger>
          <TabsTrigger value="jobs">{lang === "ar" ? "تحليل الوظائف" : "Jobs"}</TabsTrigger>
          <TabsTrigger value="trends">{lang === "ar" ? "اتجاهات" : "Trends"}</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-3 mt-3">
          <OverviewSections
            lang={lang}
            prefs={prefs}
            saudiCount={saudiCount}
            nonSaudiCount={nonSaudiCount}
            nationalityData={nationalityData}
            educationData={educationData}
            genderData={genderData}
            salaryByPosition={salaryByPosition}
            currentCityData={cityData}
            preferredCityData={preferredCityData}
            trendData={dailyTrend.map(d => ({ name: d.date, value: d.total }))}
            majorData={majorData}
            experienceData={experienceData}
            jobTypeData={jobTypeData}
          />
        </TabsContent>


        {/* FUNNEL */}
        <TabsContent value="funnel" className="space-y-3 mt-3">
          <div className="grid lg:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-1.5"><Target className="w-4 h-4" />{lang === "ar" ? "قمع التوظيف" : "Recruitment Funnel"}</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer><FunnelChart>
                    <Tooltip />
                    <Funnel dataKey="value" data={funnelData} isAnimationActive>
                      <LabelList position="right" fill="#000" stroke="none" dataKey="name" className="text-xs" />
                      <LabelList position="center" fill="#fff" stroke="none" dataKey="value" className="text-sm font-bold" />
                    </Funnel>
                  </FunnelChart></ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-sm">{lang === "ar" ? "نسب التحويل بين المراحل" : "Stage-to-Stage Conversion"}</CardTitle></CardHeader>
              <CardContent className="space-y-3 pt-2">
                {funnelData.map((stage, i) => {
                  const prev = i > 0 ? funnelData[i - 1].value : stage.value;
                  const pct = prev > 0 ? (stage.value / prev) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{stage.name}</span>
                        <span className="text-muted-foreground">{stage.value} • {pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: stage.fill }} /></div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* GEOGRAPHIC */}
        <TabsContent value="geo" className="space-y-3 mt-3">
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-1.5"><MapPin className="w-4 h-4" />{lang === "ar" ? "الخريطة الحرارية للمدن" : "City Heatmap"}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {cityHeatmap.map((c, i) => {
                  const intensity = c.value / maxCity;
                  return (
                    <div key={i} className="rounded-lg p-3 text-center transition-transform hover:scale-105 cursor-default" style={{ background: `rgba(26, 54, 93, ${0.15 + intensity * 0.85})`, color: intensity > 0.5 ? "#fff" : "#1a365d" }}>
                      <div className="text-xs font-medium truncate">{c.name}</div>
                      <div className="text-xl font-bold mt-1">{c.value}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <div className="grid md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-sm">{lang === "ar" ? "مدينة السكن الحالية" : "Current City"}</CardTitle></CardHeader>
              <CardContent><div className="h-[260px]"><ResponsiveContainer><BarChart data={cityData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} /><YAxis /><Tooltip /><Bar dataKey="value" fill="#1a365d" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-sm">{lang === "ar" ? "المدينة المفضلة" : "Preferred City"}</CardTitle></CardHeader>
              <CardContent><div className="h-[260px]"><ResponsiveContainer><BarChart data={preferredCityData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} /><YAxis /><Tooltip /><Bar dataKey="value" fill="#2f855a" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* JOBS */}
        <TabsContent value="jobs" className="space-y-3 mt-3">
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-1.5"><Briefcase className="w-4 h-4" />{lang === "ar" ? "الوظائف مقابل المتقدمين" : "Jobs vs Applicants"}</CardTitle></CardHeader>
            <CardContent>
              {jobsAnalysis.length === 0 ? <p className="text-center text-muted-foreground text-sm py-8">{lang === "ar" ? "لا توجد وظائف نشطة" : "No active jobs"}</p> : (
                <div className="h-[340px]"><ResponsiveContainer><ComposedChart data={jobsAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={70} /><YAxis yAxisId="left" /><YAxis yAxisId="right" orientation="right" /><Tooltip /><Legend />
                  <Bar yAxisId="left" dataKey="applicants" fill="#1a365d" name={lang === "ar" ? "متقدمون" : "Applicants"} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="vacancies" fill="#2f855a" name={lang === "ar" ? "شواغر" : "Vacancies"} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" dataKey="ratio" stroke="#eab308" strokeWidth={2} name={lang === "ar" ? "نسبة التغطية" : "Coverage Ratio"} />
                </ComposedChart></ResponsiveContainer></div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm">{lang === "ar" ? "أعلى الوظائف طلباً" : "Top Demanded Positions"}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {salaryByPosition.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.applicants} {lang === "ar" ? "متقدم" : "applicants"} • {lang === "ar" ? "متوسط راتب:" : "Avg salary:"} {p.avg.toLocaleString()} SAR</div>
                    </div>
                    <Badge variant="secondary">{p.applicants}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRENDS */}
        <TabsContent value="trends" className="space-y-3 mt-3">
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-1.5"><TrendingUp className="w-4 h-4" />{lang === "ar" ? "حركة التقديم - 30 يوم" : "Application Trend - 30 days"}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[280px]"><ResponsiveContainer><AreaChart data={dailyTrend}>
                <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1a365d" stopOpacity={0.4} /><stop offset="95%" stopColor="#1a365d" stopOpacity={0} /></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2f855a" stopOpacity={0.4} /><stop offset="95%" stopColor="#2f855a" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" /><YAxis /><Tooltip /><Legend />
                <Area type="monotone" dataKey="total" stroke="#1a365d" fill="url(#g1)" name={lang === "ar" ? "الإجمالي" : "Total"} />
                <Area type="monotone" dataKey="saudi" stroke="#2f855a" fill="url(#g2)" name={lang === "ar" ? "سعودي" : "Saudi"} />
              </AreaChart></ResponsiveContainer></div>
            </CardContent>
          </Card>
          {periodChange && (
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-1.5"><Calendar className="w-4 h-4" />{lang === "ar" ? "مقارنة الفترات" : "Period Comparison"}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-xs text-muted-foreground">{lang === "ar" ? "الفترة السابقة" : "Previous"}</p><p className="text-2xl font-bold">{previousPeriod.length}</p></div>
                  <div><p className="text-xs text-muted-foreground">{lang === "ar" ? "الفترة الحالية" : "Current"}</p><p className="text-2xl font-bold text-primary">{filtered.length}</p></div>
                  <div><p className="text-xs text-muted-foreground">{lang === "ar" ? "التغيير" : "Change"}</p><p className={`text-2xl font-bold ${periodChange.pct >= 0 ? "text-green-600" : "text-red-600"}`}>{periodChange.pct >= 0 ? "+" : ""}{periodChange.pct}%</p></div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <>
      {Body}
      <Dialog open={presentationMode} onOpenChange={setPresentationMode}>
        <DialogContent className="max-w-[98vw] max-h-[98vh] overflow-auto p-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-center">{lang === "ar" ? "لوحة العرض التنفيذي" : "Executive Dashboard"}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={Users} label={lang === "ar" ? "إجمالي" : "Total"} value={filtered.length} color="#1a365d" />
              <Kpi icon={Globe} label={lang === "ar" ? "السعودة" : "Saudization"} value={`${saudizationRate}%`} color="#2f855a" />
              <Kpi icon={Target} label={lang === "ar" ? "تحويل" : "Conversion"} value={`${conversionRate}%`} color="#a855f7" />
              <Kpi icon={Briefcase} label={lang === "ar" ? "وظائف" : "Jobs"} value={stats.activeJobs} color="#3b82f6" />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Card><CardContent className="p-3"><div className="h-[300px]"><ResponsiveContainer><FunnelChart><Tooltip /><Funnel dataKey="value" data={funnelData}><LabelList position="right" fill="#000" dataKey="name" /><LabelList position="center" fill="#fff" dataKey="value" /></Funnel></FunnelChart></ResponsiveContainer></div></CardContent></Card>
              <Card><CardContent className="p-3"><div className="h-[300px]"><ResponsiveContainer><AreaChart data={dailyTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 9 }} /><YAxis /><Tooltip /><Area dataKey="total" stroke="#1a365d" fill="#1a365d" fillOpacity={0.2} /></AreaChart></ResponsiveContainer></div></CardContent></Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// =========================================================================
// Customizable Overview sections — visibility + order + chart type from prefs
// =========================================================================
interface OverviewProps {
  lang: "ar" | "en";
  prefs: DashboardPrefs;
  saudiCount: number;
  nonSaudiCount: number;
  nationalityData: { name: string; value: number }[];
  educationData: { name: string; value: number }[];
  genderData: { name: string; value: number }[];
  salaryByPosition: { name: string; avg: number; applicants: number }[];
  currentCityData: { name: string; value: number }[];
  preferredCityData: { name: string; value: number }[];
  trendData: { name: string; value: number }[];
  majorData: { name: string; value: number }[];
  experienceData: { name: string; value: number }[];
  jobTypeData: { name: string; value: number }[];
}

const LegendBadges = ({ data }: { data: { name: string; value: number }[] }) => (
  <div className="mt-3 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto pe-1">
    {data.slice(0, 10).map((item, i) => (
      <span key={`${item.name}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">
        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
        <span className="truncate">{item.name}</span>
        <span className="font-bold text-foreground">{item.value}</span>
      </span>
    ))}
  </div>
);

const renderChart = (data: { name: string; value: number }[], type: ChartType | undefined) => {
  if (!data || data.length === 0) return <p className="text-center text-muted-foreground text-xs py-8">-</p>;
  const compactData = data.slice(0, 10);
  switch (type) {
    case "donut":
      return (
        <><div className="h-[185px]"><ResponsiveContainer><PieChart margin={{ top: 12, right: 18, bottom: 12, left: 18 }}>
          <Pie data={compactData} dataKey="value" cx="50%" cy="50%" innerRadius="52%" outerRadius="78%" paddingAngle={2} labelLine={false}>
            {compactData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie><Tooltip />
        </PieChart></ResponsiveContainer></div><LegendBadges data={compactData} /></>
      );
    case "pie":
      return (
        <><div className="h-[185px]"><ResponsiveContainer><PieChart margin={{ top: 12, right: 18, bottom: 12, left: 18 }}>
          <Pie data={compactData} dataKey="value" cx="50%" cy="50%" outerRadius="78%" paddingAngle={1} labelLine={false}>
            {compactData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie><Tooltip />
        </PieChart></ResponsiveContainer></div><LegendBadges data={compactData} /></>
      );
    case "barH":
      return (
        <ResponsiveContainer><BarChart data={compactData} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 22 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>{compactData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
        </BarChart></ResponsiveContainer>
      );
    case "line":
      return (
        <ResponsiveContainer><ComposedChart data={compactData} margin={{ top: 10, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
          <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={3} dot={{ r: 3 }} />
        </ComposedChart></ResponsiveContainer>
      );
    case "area":
      return (
        <ResponsiveContainer><AreaChart data={compactData} margin={{ top: 10, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
          <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.22} strokeWidth={3} />
        </AreaChart></ResponsiveContainer>
      );
    case "bar":
    default:
      return (
        <ResponsiveContainer><BarChart data={compactData} margin={{ top: 10, right: 16, bottom: 36, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-18} textAnchor="end" height={54} interval={0} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>{compactData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
        </BarChart></ResponsiveContainer>
      );
  }
};

const OverviewSections = (p: OverviewProps) => {
  const { prefs } = p;
  const { lang } = p;

  const renderers: Record<string, { title: string; icon?: any; data?: { name: string; value: number }[]; custom?: (chart: ChartType | undefined) => JSX.Element }> = {
    saudization: {
      title: lang === "ar" ? "السعودة" : "Saudization",
      icon: Globe,
      data: [
        { name: lang === "ar" ? "سعودي" : "Saudi", value: p.saudiCount },
        { name: lang === "ar" ? "غير سعودي" : "Non-Saudi", value: p.nonSaudiCount },
      ],
    },
    nationality: { title: lang === "ar" ? "أعلى الجنسيات" : "Top Nationalities", icon: Globe, data: p.nationalityData },
    currentCity: { title: lang === "ar" ? "مدينة السكن" : "Current City", icon: MapPin, data: p.currentCityData },
    preferredCity: { title: lang === "ar" ? "المدينة المفضلة" : "Preferred City", icon: MapPin, data: p.preferredCityData },
    education: { title: lang === "ar" ? "المؤهلات" : "Education", icon: GraduationCap, data: p.educationData },
    gender: { title: lang === "ar" ? "الجنس" : "Gender", data: p.genderData },
    trend: { title: lang === "ar" ? "حركة التقديم" : "Application Trend", icon: TrendingUp, data: p.trendData },
    majors: { title: lang === "ar" ? "التخصصات" : "Majors", icon: Award, data: p.majorData },
    experience: { title: lang === "ar" ? "سنوات الخبرة" : "Experience", icon: Briefcase, data: p.experienceData },
    jobType: { title: lang === "ar" ? "نوع العمل" : "Job Type", icon: Building2, data: p.jobTypeData },
    salary: {
      title: lang === "ar" ? "متوسط الراتب لكل وظيفة" : "Avg Salary by Position",
      icon: DollarSign,
      custom: (chart) => {
        const data = p.salaryByPosition.slice(0, 8).map(s => ({ name: s.name, value: s.avg }));
        return renderChart(data, chart || "barH");
      },
    },
  };

  const visible = prefs.sections.filter(s => s.visible && renderers[s.id]);
  if (visible.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-8">{lang === "ar" ? "كل الأقسام مخفية — افتح التخصيص" : "All sections hidden — open Customize"}</p>;
  }

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {visible.map(s => {
        const r = renderers[s.id];
        const Icon = r.icon;
        return (
          <Card key={s.id} className="dashboard-chart-card overflow-hidden border-border/70 shadow-card transition-shadow hover:shadow-elevated">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm flex items-center gap-1.5">
                {Icon && <Icon className="w-4 h-4 text-primary" />}{r.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className={prefs.density === "compact" ? "h-[260px]" : "h-[310px]"}>
                {r.custom ? r.custom(s.chart) : renderChart(r.data!, s.chart)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AnalyticsHub;
