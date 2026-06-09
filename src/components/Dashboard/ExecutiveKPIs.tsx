import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Clock, UserCheck, UserX, Target, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface KPIs {
  totalApplicants: number;
  totalLast30: number;
  totalPrev30: number;
  hired: number;
  rejected: number;
  inPipeline: number;
  avgTimeToHireDays: number | null;
  hireRate: number;
  rejectionRate: number;
  monthlyHires: { month: string; hires: number }[];
}

const ExecutiveKPIs = () => {
  const { lang } = useLanguage();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const d60 = new Date(now.getTime() - 60 * 86400000).toISOString();

    const [appsRes, candRes] = await Promise.all([
      supabase.from("applicants").select("id, created_at, status", { count: "exact" }),
      supabase.from("recruitment_candidates").select("id, status, created_at, hire_date, actual_start_date, expected_start_date"),
    ]);

    const apps = appsRes.data || [];
    const cands = candRes.data || [];

    const totalLast30 = apps.filter((a: any) => a.created_at >= d30).length;
    const totalPrev30 = apps.filter((a: any) => a.created_at >= d60 && a.created_at < d30).length;

    const hired = cands.filter((c: any) => ["hired", "started"].includes(c.status)).length;
    const rejected = cands.filter((c: any) => c.status === "rejected").length;
    const inPipeline = cands.filter((c: any) => !["hired", "started", "rejected"].includes(c.status)).length;
    const totalCands = cands.length || 1;
    const hireRate = (hired / totalCands) * 100;
    const rejectionRate = (rejected / totalCands) * 100;

    // Avg time to hire: hire_date - created_at
    const hiredWithDates = cands.filter((c: any) => c.hire_date && c.created_at);
    const avgTimeToHireDays = hiredWithDates.length
      ? Math.round(
          hiredWithDates.reduce((sum: number, c: any) => {
            const d1 = new Date(c.created_at).getTime();
            const d2 = new Date(c.hire_date).getTime();
            return sum + (d2 - d1) / 86400000;
          }, 0) / hiredWithDates.length
        )
      : null;

    // Last 6 months hires
    const monthBuckets: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = dt.toISOString().slice(0, 7);
      monthBuckets[key] = 0;
    }
    cands.filter((c: any) => ["hired", "started"].includes(c.status) && c.hire_date).forEach((c: any) => {
      const key = c.hire_date.slice(0, 7);
      if (key in monthBuckets) monthBuckets[key]++;
    });
    const monthlyHires = Object.entries(monthBuckets).map(([month, hires]) => ({ month, hires }));

    setKpis({
      totalApplicants: apps.length,
      totalLast30,
      totalPrev30,
      hired,
      rejected,
      inPipeline,
      avgTimeToHireDays,
      hireRate,
      rejectionRate,
      monthlyHires,
    });
    setLoading(false);
  };

  if (loading || !kpis) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  const growth = kpis.totalPrev30 > 0 ? ((kpis.totalLast30 - kpis.totalPrev30) / kpis.totalPrev30) * 100 : 0;
  const trendingUp = growth >= 0;
  const maxHires = Math.max(...kpis.monthlyHires.map(m => m.hires), 1);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {lang === "ar" ? "متقدمون آخر 30 يوم" : "Applicants (30d)"}
            </CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalLast30}</div>
            <div className="flex items-center gap-1 text-xs mt-1">
              {trendingUp ? <TrendingUp className="w-3 h-3 text-emerald-600" /> : <TrendingDown className="w-3 h-3 text-destructive" />}
              <span className={trendingUp ? "text-emerald-600" : "text-destructive"}>
                {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">{lang === "ar" ? "مقارنة بـ30 يوم سابق" : "vs prev 30d"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {lang === "ar" ? "معدل التوظيف" : "Hire Rate"}
            </CardTitle>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.hireRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {kpis.hired} {lang === "ar" ? "موظف من" : "hired of"} {kpis.hired + kpis.rejected + kpis.inPipeline}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {lang === "ar" ? "نسبة الرفض" : "Rejection Rate"}
            </CardTitle>
            <UserX className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.rejectionRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {kpis.rejected} {lang === "ar" ? "مرفوض" : "rejected"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {lang === "ar" ? "متوسط زمن التوظيف" : "Avg Time to Hire"}
            </CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.avgTimeToHireDays != null ? `${kpis.avgTimeToHireDays}` : "—"}
              {kpis.avgTimeToHireDays != null && (
                <span className="text-sm text-muted-foreground font-normal ms-1">
                  {lang === "ar" ? "يوم" : "days"}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {lang === "ar" ? "من التقديم للتوظيف" : "Application → hire"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4" />
            {lang === "ar" ? "اتجاه التوظيف (آخر 6 أشهر)" : "Hiring Trend (last 6 months)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-32">
            {kpis.monthlyHires.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div className="text-xs font-medium">{m.hires}</div>
                <div
                  className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                  style={{ height: `${(m.hires / maxHires) * 100}%`, minHeight: m.hires > 0 ? 4 : 1 }}
                />
                <div className="text-[10px] text-muted-foreground">{m.month.slice(5)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutiveKPIs;
