import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Stethoscope, AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, Lightbulb, Wrench } from "lucide-react";
import { toast } from "sonner";

interface Issue {
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  root_cause: string;
  fix_steps: string[];
  auto_fixable?: boolean;
}
interface DoctorResult {
  health_score?: number;
  summary?: string;
  issues?: Issue[];
  recommendations?: string[];
  analyzed_count?: number;
  client_error_count?: number;
}

const SEV_COLOR: Record<string, string> = {
  low: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  critical: "bg-destructive/15 text-destructive",
};

const AiSystemDoctor = () => {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DoctorResult | null>(null);
  const clientErrorsRef = useRef<{ message: string; source?: string; ts: string }[]>([]);

  // Capture browser errors in real-time
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      clientErrorsRef.current.push({ message: e.message, source: `${e.filename}:${e.lineno}`, ts: new Date().toISOString() });
      if (clientErrorsRef.current.length > 50) clientErrorsRef.current.shift();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      clientErrorsRef.current.push({ message: String(e.reason?.message || e.reason), ts: new Date().toISOString() });
      if (clientErrorsRef.current.length > 50) clientErrorsRef.current.shift();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const runDiagnosis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-system-doctor", {
        body: { lang, clientErrors: clientErrorsRef.current },
      });
      if (error) throw error;
      if (data?.error === "rate_limit") { toast.error(lang === "ar" ? "تم تجاوز الحد، حاول لاحقاً" : "Rate limit, try later"); return; }
      if (data?.error === "credits_exhausted") { toast.error(lang === "ar" ? "نفدت الأرصدة" : "Credits exhausted"); return; }
      setResult(data);
      toast.success(lang === "ar" ? "اكتمل الفحص" : "Diagnosis complete");
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const score = result?.health_score ?? 0;
  const scoreColor = score >= 80 ? "text-green-500" : score >= 60 ? "text-amber-500" : "text-destructive";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5" />
            {lang === "ar" ? "طبيب النظام بالذكاء الاصطناعي" : "AI System Doctor"}
          </CardTitle>
          <Button onClick={runDiagnosis} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? (lang === "ar" ? "جاري التحليل..." : "Analyzing...") : (lang === "ar" ? "فحص شامل" : "Run Diagnosis")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {lang === "ar"
            ? "يحلّل الذكاء الاصطناعي سجل النظام وأخطاء الواجهة ويقدّم تشخيصاً وخطوات الإصلاح."
            : "AI analyzes system logs and browser errors and provides diagnosis and fix steps."}
        </p>

        {!result && !loading && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {lang === "ar" ? "اضغط (فحص شامل) لبدء التحليل" : "Click 'Run Diagnosis' to start"}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Health score */}
            <Card className="bg-muted/40">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{lang === "ar" ? "صحة النظام" : "System Health"}</div>
                    <div className={`text-4xl font-bold ${scoreColor}`}>{score}<span className="text-lg text-muted-foreground">/100</span></div>
                  </div>
                  <div className="text-xs text-muted-foreground text-end">
                    <div>{lang === "ar" ? `تم تحليل ${result.analyzed_count || 0} حدث` : `${result.analyzed_count || 0} events analyzed`}</div>
                    <div>{lang === "ar" ? `${result.client_error_count || 0} أخطاء واجهة` : `${result.client_error_count || 0} client errors`}</div>
                  </div>
                </div>
                <Progress value={score} className="h-2" />
                {result.summary && <p className="text-sm">{result.summary}</p>}
              </CardContent>
            </Card>

            {/* Issues */}
            {result.issues && result.issues.length > 0 ? (
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2"><ShieldAlert className="w-4 h-4" />{lang === "ar" ? "المشاكل المكتشفة" : "Detected Issues"}</h3>
                {result.issues.map((iss, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span className="font-medium">{iss.title}</span>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={SEV_COLOR[iss.severity] || ""} variant="secondary">{iss.severity}</Badge>
                          {iss.auto_fixable && <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-400 gap-1"><Wrench className="w-3 h-3" />{lang === "ar" ? "قابل للإصلاح تلقائياً" : "Auto-fixable"}</Badge>}
                        </div>
                      </div>
                      {iss.root_cause && <div className="text-sm text-muted-foreground"><b>{lang === "ar" ? "السبب:" : "Cause:"}</b> {iss.root_cause}</div>}
                      {iss.fix_steps?.length > 0 && (
                        <div className="text-sm">
                          <b>{lang === "ar" ? "خطوات الإصلاح:" : "Fix steps:"}</b>
                          <ol className="list-decimal ms-5 mt-1 space-y-1">
                            {iss.fix_steps.map((s, j) => <li key={j}>{s}</li>)}
                          </ol>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                {lang === "ar" ? "لا توجد مشاكل حرجة" : "No critical issues detected"}
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-2"><Lightbulb className="w-4 h-4" />{lang === "ar" ? "توصيات وقائية" : "Recommendations"}</h3>
                  <ul className="list-disc ms-5 space-y-1 text-sm">
                    {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AiSystemDoctor;
