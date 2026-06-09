import { useMemo, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from "recharts";
import {
  Users, MapPin, DollarSign, GraduationCap, Globe, Briefcase,
  TrendingUp, Building2, Printer, FileDown, Layers,
} from "lucide-react";
import * as XLSX from "xlsx";
import { normalizeCity, normalizeNationality, normalizeEducation, normalizeGender, groupByNormalized } from "@/lib/analyticsNormalize";
import { useValueSynonyms } from "@/hooks/useValueSynonyms";
import { useDashboardPrefs, ChartType, SECTION_LABELS } from "@/hooks/useDashboardPrefs";
import DashboardCustomizer from "./DashboardCustomizer";

const COLORS = [
  "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#ef4444",
  "#06b6d4", "#f97316", "#ec4899", "#6366f1", "#14b8a6",
];

interface Applicant {
  id: string; full_name: string; nationality: string | null; current_city: string | null;
  preferred_city: string | null; current_salary: string | null; expected_salary: string | null;
  desired_position: string | null; education_level: string | null; gender: string | null;
  years_experience: string | null; status: string; created_at: string; job_type: string | null;
  major: string | null; marital_status: string | null;
}

interface Props { applicants: Applicant[]; }

const groupBy = (arr: any[], key: string) => {
  const map: Record<string, number> = {};
  arr.forEach(item => { const val = item[key] || "N/A"; map[val] = (map[val] || 0) + 1; });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
};

// Renders any compatible dataset in the chosen chart type
const DynamicChart = ({ data, type, total }: { data: { name: string; value: number }[]; type: ChartType; total: number }) => {
  const tip = (
    <Tooltip formatter={(v: number, _n, p: any) => [`${v} (${((v / Math.max(total,1)) * 100).toFixed(1)}%)`, p?.payload?.name]} />
  );
  if (type === "pie" || type === "donut") {
    const inner = type === "donut" ? 45 : 0;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={inner} outerRadius={75} paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          {tip}
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (type === "barH") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} />
          {tip}
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis />
          {tip}
          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis />
          {tip}
          <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  // bar (vertical)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis />
        {tip}
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const Legend = ({ data }: { data: { name: string; value: number }[] }) => (
  <div className="flex flex-wrap gap-1.5 justify-center mt-2 max-h-[88px] overflow-y-auto px-1">
    {data.map((e, i) => (
      <Badge key={i} variant="secondary" className="text-[11px] gap-1 font-normal" style={{ borderInlineStart: `3px solid ${COLORS[i % COLORS.length]}` }}>
        <span className="truncate max-w-[110px]">{e.name}</span>
        <span className="opacity-60">{e.value}</span>
      </Badge>
    ))}
  </div>
);

const AdvancedAnalytics = ({ applicants }: Props) => {
  const { lang } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);
  const { prefs } = useDashboardPrefs();
  const { rows: synRows } = useValueSynonyms();
  const synKey = synRows.length;

  const nationalityData = useMemo(() => groupByNormalized(applicants, a => a.nationality, normalizeNationality, lang, 10), [applicants, lang, synKey]);
  const cityData = useMemo(() => groupByNormalized(applicants, a => a.current_city, normalizeCity, lang, 10), [applicants, lang, synKey]);
  const preferredCityData = useMemo(() => groupByNormalized(applicants, a => a.preferred_city, normalizeCity, lang, 10), [applicants, lang, synKey]);
  const educationData = useMemo(() => groupByNormalized(applicants, a => a.education_level, normalizeEducation, lang), [applicants, lang, synKey]);
  const genderData = useMemo(() => groupByNormalized(applicants, a => a.gender, normalizeGender, lang), [applicants, lang, synKey]);
  const jobTypeData = useMemo(() => groupBy(applicants, "job_type"), [applicants]);
  const majorData = useMemo(() => groupBy(applicants, "major").slice(0, 8), [applicants]);
  const experienceData = useMemo(() => groupBy(applicants, "years_experience"), [applicants]);

  const saudiCount = useMemo(() =>
    applicants.filter(a => a.nationality?.includes("سعود") || a.nationality?.toLowerCase().includes("saudi")).length,
    [applicants]
  );
  const nonSaudiCount = applicants.length - saudiCount;
  const saudizationData = useMemo(() => [
    { name: lang === "ar" ? "سعودي" : "Saudi", value: saudiCount },
    { name: lang === "ar" ? "غير سعودي" : "Non-Saudi", value: nonSaudiCount },
  ], [saudiCount, nonSaudiCount, lang]);

  const salaryByPosition = useMemo(() => {
    const posMap: Record<string, { total: number; count: number }> = {};
    applicants.forEach(a => {
      if (!a.desired_position || !a.expected_salary) return;
      const salary = parseInt(a.expected_salary.replace(/[^\d]/g, ""));
      if (isNaN(salary) || salary === 0) return;
      if (!posMap[a.desired_position]) posMap[a.desired_position] = { total: 0, count: 0 };
      posMap[a.desired_position].total += salary;
      posMap[a.desired_position].count += 1;
    });
    return Object.entries(posMap)
      .map(([name, { total, count }]) => ({ name: name.substring(0, 20), value: Math.round(total / count) }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [applicants]);

  const dailyTrend = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      days[d.toISOString().split("T")[0]] = 0;
    }
    applicants.forEach(a => { const day = a.created_at.split("T")[0]; if (day in days) days[day]++; });
    return Object.entries(days).map(([date, count]) => ({
      name: new Date(date).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { day: "numeric", month: "short" }),
      value: count,
    }));
  }, [applicants, lang]);

  const stats = useMemo(() => {
    const totalPositions = new Set(applicants.map(a => a.desired_position).filter(Boolean)).size;
    const totalCities = new Set(applicants.map(a => a.current_city).filter(Boolean)).size;
    const saudizationRate = applicants.length > 0 ? Math.round((saudiCount / applicants.length) * 100) : 0;
    return { totalPositions, totalCities, saudizationRate };
  }, [applicants, saudiCount]);

  const handleExportAnalytics = () => {
    const wb = XLSX.utils.book_new();
    const addSheet = (data: any[], name: string) => {
      if (data.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name.substring(0, 31));
    };
    addSheet(nationalityData, "Nationalities");
    addSheet(cityData, "CurrentCities");
    addSheet(preferredCityData, "PreferredCities");
    addSheet(educationData, "Education");
    addSheet(salaryByPosition, "Salary");
    addSheet(genderData, "Gender");
    addSheet(majorData, "Majors");
    XLSX.writeFile(wb, `analytics_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <Card className="hover:shadow-elevated transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}><Icon className="w-5 h-5 text-white" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Section registry
  const sectionData: Record<string, { icon: any; data: { name: string; value: number }[]; height?: number; showLegend?: boolean; customRender?: (chart: ChartType) => JSX.Element }> = {
    saudization: { icon: Globe, data: saudizationData, height: 220 },
    nationality: { icon: Globe, data: nationalityData, height: 250 },
    currentCity: { icon: MapPin, data: cityData, height: 220, showLegend: true },
    preferredCity: { icon: Building2, data: preferredCityData, height: 220 },
    salary: { icon: DollarSign, data: salaryByPosition, height: 250 },
    education: { icon: GraduationCap, data: educationData, height: 200, showLegend: true },
    trend: { icon: TrendingUp, data: dailyTrend, height: 200 },
    gender: { icon: Users, data: genderData, height: 200, showLegend: true },
    experience: { icon: Briefcase, data: experienceData, height: 200 },
    jobType: { icon: Briefcase, data: jobTypeData, height: 200, showLegend: true },
    majors: { icon: Layers, data: majorData, customRender: () => (
      <div className="space-y-2">
        {majorData.map((m, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="truncate flex-1">{m.name}</span>
            <Badge variant="secondary" className="shrink-0">{m.value}</Badge>
          </div>
        ))}
        {majorData.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">-</p>}
      </div>
    )},
  };

  const visibleSections = prefs.sections.filter(s => s.visible && sectionData[s.id]);

  return (
    <div ref={printRef} className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          {lang === "ar" ? "تحليلات متقدمة" : "Advanced Analytics"}
        </h3>
        <div className="flex gap-2 flex-wrap">
          <DashboardCustomizer />
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportAnalytics}>
            <FileDown className="w-4 h-4" />{lang === "ar" ? "Excel" : "Excel"}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />{lang === "ar" ? "PDF" : "PDF"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label={lang === "ar" ? "إجمالي المتقدمين" : "Total Applicants"} value={applicants.length} color="bg-blue-500" />
        <StatCard icon={Globe} label={lang === "ar" ? "نسبة السعودة" : "Saudization"} value={`${stats.saudizationRate}%`} color="bg-green-500" />
        <StatCard icon={Briefcase} label={lang === "ar" ? "وظائف مطلوبة" : "Positions"} value={stats.totalPositions} color="bg-purple-500" />
        <StatCard icon={MapPin} label={lang === "ar" ? "مدن مختلفة" : "Cities"} value={stats.totalCities} color="bg-orange-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleSections.map(sec => {
          const meta = sectionData[sec.id];
          const Icon = meta.icon;
          const label = SECTION_LABELS[sec.id]?.[lang] || sec.id;
          const chart = sec.chart || "bar";
          return (
            <Card key={sec.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className="w-4 h-4" />{label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {meta.customRender ? meta.customRender(chart) : (
                  <>
                    {meta.data.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8 text-sm">{lang === "ar" ? "لا توجد بيانات" : "No data"}</p>
                    ) : (
                      <>
                        <div style={{ height: meta.height || 220 }}>
                          <DynamicChart data={meta.data} type={chart} total={applicants.length} />
                        </div>
                        {meta.showLegend && <Legend data={meta.data} />}
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdvancedAnalytics;
