import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Activity, AlertTriangle, CreditCard, ExternalLink, RefreshCw, Sparkles, Zap } from "lucide-react";

interface UsageSetting {
  id: string;
  service: string;
  display_name_ar: string;
  display_name_en: string | null;
  monthly_cap_usd: number;
  warn_threshold_pct: number;
  hard_stop: boolean;
}

interface ServiceStat {
  service: string;
  totalCost: number;
  totalCalls: number;
  totalTokens: number;
  errors: number;
  lastUsed: string | null;
}

export const AiUsageMonitor = ({ lang }: { lang: "ar" | "en" }) => {
  const isAr = lang === "ar";
  const [settings, setSettings] = useState<UsageSetting[]>([]);
  const [stats, setStats] = useState<Record<string, ServiceStat>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const monthStart = (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString(); })();

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: s }, { data: logs }] = await Promise.all([
      supabase.from("ai_usage_settings").select("*").order("service"),
      supabase.from("ai_usage_log").select("service,estimated_cost_usd,total_tokens,status,created_at").gte("created_at", monthStart),
    ]);
    setSettings((s as any) || []);
    const map: Record<string, ServiceStat> = {};
    for (const l of (logs as any[]) || []) {
      const k = l.service;
      if (!map[k]) map[k] = { service: k, totalCost: 0, totalCalls: 0, totalTokens: 0, errors: 0, lastUsed: null };
      map[k].totalCost += Number(l.estimated_cost_usd || 0);
      map[k].totalTokens += Number(l.total_tokens || 0);
      map[k].totalCalls += 1;
      if (l.status !== "success") map[k].errors += 1;
      if (!map[k].lastUsed || l.created_at > map[k].lastUsed) map[k].lastUsed = l.created_at;
    }
    setStats(map);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const updateCap = async (row: UsageSetting, patch: Partial<UsageSetting>) => {
    setSavingId(row.id);
    const { error } = await supabase.from("ai_usage_settings").update(patch).eq("id", row.id);
    setSavingId(null);
    if (error) { toast.error(isAr ? "تعذر الحفظ" : "Save failed"); return; }
    toast.success(isAr ? "تم الحفظ" : "Saved");
    fetchAll();
  };

  const totalSpend = Object.values(stats).reduce((s, x) => s + x.totalCost, 0);
  const totalCalls = Object.values(stats).reduce((s, x) => s + x.totalCalls, 0);
  const totalErrors = Object.values(stats).reduce((s, x) => s + x.errors, 0);
  const exhaustedService = Object.entries(stats).find(([, st]) => {
    const cap = settings.find((c) => c.service === st.service)?.monthly_cap_usd || Infinity;
    return st.totalCost >= cap;
  });

  return (
    <div className="space-y-4">
      {/* Banner if credits exhausted */}
      {exhaustedService && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{isAr ? "تم تجاوز السقف الشهري لإحدى الخدمات" : "Monthly cap exceeded"}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3 mt-2">
            <span>{isAr ? "اشحن رصيدك أو ارفع السقف للمتابعة." : "Top up or raise the cap to continue."}</span>
            <Button size="sm" variant="default" asChild>
              <a href="https://lovable.dev/settings/workspace" target="_blank" rel="noreferrer" className="gap-1">
                <CreditCard className="w-3 h-3" />{isAr ? "شحن الرصيد" : "Top up"}<ExternalLink className="w-3 h-3" />
              </a>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Activity className="w-3 h-3" />{isAr ? "إجمالي الاستهلاك (شهرياً)" : "Monthly spend"}</div><div className="text-2xl font-bold mt-1">${totalSpend.toFixed(4)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Zap className="w-3 h-3" />{isAr ? "عدد الاستدعاءات" : "Total calls"}</div><div className="text-2xl font-bold mt-1">{totalCalls}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Sparkles className="w-3 h-3" />{isAr ? "خدمات نشطة" : "Active services"}</div><div className="text-2xl font-bold mt-1">{settings.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><AlertTriangle className="w-3 h-3" />{isAr ? "أخطاء / تنبيهات" : "Errors"}</div><div className="text-2xl font-bold mt-1">{totalErrors}</div></CardContent></Card>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">{isAr ? "خدمات الذكاء الاصطناعي" : "AI Services"}</h3>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-1"><RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />{isAr ? "تحديث" : "Refresh"}</Button>
      </div>

      {/* Per-service cards */}
      <div className="grid md:grid-cols-2 gap-3">
        {settings.map((s) => {
          const st = stats[s.service] || { totalCost: 0, totalCalls: 0, totalTokens: 0, errors: 0, lastUsed: null } as ServiceStat;
          const pct = Math.min(100, (st.totalCost / Math.max(s.monthly_cap_usd, 0.0001)) * 100);
          const isWarn = pct >= s.warn_threshold_pct;
          const isOver = pct >= 100;
          return (
            <Card key={s.id} className={isOver ? "border-destructive" : isWarn ? "border-amber-500" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span>{isAr ? s.display_name_ar : (s.display_name_en || s.display_name_ar)}</span>
                  {isOver ? <Badge variant="destructive">{isAr ? "نفد" : "Exhausted"}</Badge> : isWarn ? <Badge className="bg-amber-500">{isAr ? "تحذير" : "Warning"}</Badge> : <Badge variant="secondary">{isAr ? "ضمن الحد" : "OK"}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{isAr ? "الاستهلاك" : "Used"}: ${st.totalCost.toFixed(4)}</span>
                    <span>{isAr ? "السقف" : "Cap"}: ${Number(s.monthly_cap_usd).toFixed(2)}</span>
                  </div>
                  <Progress value={pct} className={isOver ? "[&>div]:bg-destructive" : isWarn ? "[&>div]:bg-amber-500" : ""} />
                  <div className="text-xs text-muted-foreground mt-1">{pct.toFixed(1)}% — {isAr ? "المتبقي" : "Remaining"}: ${Math.max(0, s.monthly_cap_usd - st.totalCost).toFixed(4)}</div>
                </div>
                <div className="grid grid-cols-3 text-center text-xs">
                  <div><div className="font-bold text-sm">{st.totalCalls}</div><div className="text-muted-foreground">{isAr ? "استدعاء" : "calls"}</div></div>
                  <div><div className="font-bold text-sm">{st.totalTokens.toLocaleString()}</div><div className="text-muted-foreground">{isAr ? "توكنز" : "tokens"}</div></div>
                  <div><div className="font-bold text-sm text-destructive">{st.errors}</div><div className="text-muted-foreground">{isAr ? "أخطاء" : "errors"}</div></div>
                </div>
                <div className="flex items-end gap-2 pt-2 border-t">
                  <div className="flex-1">
                    <Label className="text-xs">{isAr ? "السقف الشهري ($)" : "Monthly cap ($)"}</Label>
                    <Input type="number" step="0.5" defaultValue={s.monthly_cap_usd} onBlur={(e) => { const v = Number(e.target.value); if (v !== s.monthly_cap_usd) updateCap(s, { monthly_cap_usd: v }); }} disabled={savingId === s.id} className="h-8" />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">{isAr ? "تنبيه %" : "Warn %"}</Label>
                    <Input type="number" min={10} max={99} defaultValue={s.warn_threshold_pct} onBlur={(e) => { const v = Number(e.target.value); if (v !== s.warn_threshold_pct) updateCap(s, { warn_threshold_pct: v }); }} disabled={savingId === s.id} className="h-8" />
                  </div>
                </div>
                {st.lastUsed && <div className="text-xs text-muted-foreground">{isAr ? "آخر استخدام" : "Last used"}: {new Date(st.lastUsed).toLocaleString(isAr ? "ar" : "en")}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Help / top-up CTA */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 space-y-2">
          <div className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" />{isAr ? "كيف أشحن الرصيد؟" : "How to top up?"}</div>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "يحصل كل حساب على $1 مجاناً للذكاء و $25 للسحابة شهرياً. عند النفاد، اشحن من إعدادات Lovable. الفائدة المباشرة: استئناف الفلترة الذكية، تحليل أعمق، تنبيهات أدق، ودعم القرار في التوظيف."
              : "Each account gets $1 free AI + $25 Cloud monthly. When exhausted, top up via Lovable Settings. You get: smart filtering resumed, deeper analysis, accurate alerts, hiring decision support."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm"><a href="https://lovable.dev/settings/workspace" target="_blank" rel="noreferrer" className="gap-1"><CreditCard className="w-3 h-3" />{isAr ? "فتح صفحة الشحن" : "Open billing"}<ExternalLink className="w-3 h-3" /></a></Button>
            <Button asChild size="sm" variant="outline"><a href="https://docs.lovable.dev/integrations/cloud" target="_blank" rel="noreferrer" className="gap-1">{isAr ? "تفاصيل الأسعار" : "Pricing details"}<ExternalLink className="w-3 h-3" /></a></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
