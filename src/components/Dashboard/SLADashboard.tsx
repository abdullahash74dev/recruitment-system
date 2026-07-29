import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Timer, Loader2, TrendingUp, Users, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useSLAConfigQuery, useUpdateSLAConfigMutation, useSLAMetricsQuery } from "@/hooks/queries/useSLADashboard";

const STAGE_LABEL = (s: string, ar: boolean) =>
  ar
    ? {
        new: "جديد", reviewing: "قيد المراجعة", phone_interview: "مقابلة هاتفية",
        in_person_interview: "مقابلة شخصية", accepted: "مقبول", hired: "تم التوظيف",
      }[s] ?? s
    : s.replace(/_/g, " ");

export default function SLADashboard() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [periodDays, setPeriodDays] = useState(90);

  const { data: configs = [], isLoading: configLoading } = useSLAConfigQuery();
  const { data: metrics, isLoading: metricsLoading } = useSLAMetricsQuery(periodDays);
  const updateMutation = useUpdateSLAConfigMutation();

  const loading = configLoading || metricsLoading;

  const chartData = (metrics?.stages ?? []).map((s) => ({
    name: STAGE_LABEL(s.stage, ar),
    [ar ? "الفعلي" : "Actual"]: s.avgDays,
    [ar ? "الهدف" : "Target"]: s.targetDays,
  }));

  const statusColor = (avg: number, target: number, warning: number) =>
    avg > target ? "text-destructive" : avg > warning ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Timer className="w-5 h-5" />{ar ? "لوحة SLA وقياس وقت التوظيف" : "SLA & Time-to-Hire"}
        </h2>
        <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[30, 90, 180, 365].map((d) => (
              <SelectItem key={d} value={String(d)}>{ar ? `آخر ${d} يوم` : `Last ${d} days`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-6 text-center">
          <Timer className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-3xl font-bold">{metrics?.avgTimeToHire ?? 0}</p>
          <p className="text-sm text-muted-foreground">{ar ? "متوسط أيام التوظيف" : "Avg Days to Hire"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Users className="w-5 h-5 mx-auto mb-1 text-blue-500" />
          <p className="text-3xl font-bold">{metrics?.totalApplicants ?? 0}</p>
          <p className="text-sm text-muted-foreground">{ar ? "إجمالي المتقدمين" : "Total Applicants"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
          <p className="text-3xl font-bold text-emerald-600">{metrics?.hiredCount ?? 0}</p>
          <p className="text-sm text-muted-foreground">{ar ? "تم توظيفهم" : "Hired"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Target className="w-5 h-5 mx-auto mb-1 text-purple-500" />
          <p className="text-3xl font-bold">{metrics?.conversionRate ?? 0}%</p>
          <p className="text-sm text-muted-foreground">{ar ? "معدل التحويل" : "Conversion Rate"}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{ar ? "الأداء مقابل الهدف لكل مرحلة" : "Actual vs Target per Stage"}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey={ar ? "الفعلي" : "Actual"} fill="hsl(var(--primary))" />
                <Bar dataKey={ar ? "الهدف" : "Target"} fill="hsl(var(--muted-foreground))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{ar ? "تفاصيل المراحل وأهداف SLA" : "Stage Detail & SLA Targets"}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "المرحلة" : "Stage"}</TableHead>
                    <TableHead>{ar ? "العدد" : "Count"}</TableHead>
                    <TableHead>{ar ? "متوسط الأيام" : "Avg Days"}</TableHead>
                    <TableHead>{ar ? "الهدف (يوم)" : "Target (days)"}</TableHead>
                    <TableHead>{ar ? "تحذير (يوم)" : "Warning (days)"}</TableHead>
                    <TableHead>{ar ? "تجاوزات" : "Breaches"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(metrics?.stages ?? []).map((s) => {
                    const config = configs.find((c) => c.stage === s.stage);
                    return (
                      <TableRow key={s.stage}>
                        <TableCell className="font-medium">{STAGE_LABEL(s.stage, ar)}</TableCell>
                        <TableCell>{s.count}</TableCell>
                        <TableCell className={`font-bold ${statusColor(s.avgDays, s.targetDays, s.warningDays)}`}>
                          {s.avgDays}
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="h-7 w-20" defaultValue={s.targetDays}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (config && v !== s.targetDays) {
                                updateMutation.mutate({ id: config.id, target_days: v, warning_days: config.warning_days });
                              }
                            }} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="h-7 w-20" defaultValue={s.warningDays}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (config && v !== s.warningDays) {
                                updateMutation.mutate({ id: config.id, target_days: config.target_days, warning_days: v });
                              }
                            }} />
                        </TableCell>
                        <TableCell>
                          {s.breachCount > 0 ? (
                            <Badge className="bg-destructive/15 text-destructive">{s.breachCount}</Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">0</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
