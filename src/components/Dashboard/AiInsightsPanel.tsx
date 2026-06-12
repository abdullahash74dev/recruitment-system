import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, RefreshCw, TrendingUp, Users, Briefcase, Lightbulb, Clock } from "lucide-react";
import { toast } from "sonner";

interface InsightsResult {
  summary?: string;
  highlights?: string[];
  applicant_insights?: string[];
  job_insights?: string[];
  recommendations?: string[];
  generated_at?: string;
}

const AiInsightsPanel = () => {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InsightsResult | null>(null);

  const generateInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: { lang },
      });
      if (error) throw error;
      if (data?.error === "rate_limit") { toast.error(lang === "ar" ? "تم تجاوز الحد، حاول لاحقاً" : "Rate limit, try later"); return; }
      if (data?.error === "credits_exhausted") { toast.error(lang === "ar" ? "نفدت الأرصدة" : "Credits exhausted"); return; }
      setResult(data);
      toast.success(lang === "ar" ? "تم إنشاء الرؤى" : "Insights generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            {lang === "ar" ? "رؤى الذكاء الاصطناعي" : "AI Insights"}
          </CardTitle>
          <Button onClick={generateInsights} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading
              ? (lang === "ar" ? "جاري التحليل..." : "Analyzing...")
              : result
                ? (lang === "ar" ? "تحديث" : "Refresh")
                : (lang === "ar" ? "إنشاء رؤى" : "Generate Insights")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {lang === "ar"
            ? "يحلّل الذكاء الاصطناعي حالة المتقدمين والوظائف الشاغرة الحالية ويقدّم ملخصاً وتوصيات مفيدة لتحسين عملية التوظيف."
            : "AI analyzes current applicants and job postings and provides a useful summary and recommendations to improve the recruitment pipeline."}
        </p>

        {!result && !loading && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {lang === "ar" ? "اضغط (إنشاء رؤى) لبدء التحليل" : "Click 'Generate Insights' to start"}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Summary */}
            {result.summary && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm">{result.summary}</p>
                  {result.generated_at && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {lang === "ar" ? "تم الإنشاء:" : "Generated:"}{" "}
                      {new Date(result.generated_at).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Highlights */}
            {result.highlights && result.highlights.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    {lang === "ar" ? "أبرز النقاط" : "Highlights"}
                  </h3>
                  <ul className="list-disc ms-5 space-y-1 text-sm">
                    {result.highlights.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Applicant insights */}
            {result.applicant_insights && result.applicant_insights.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4" />
                    {lang === "ar" ? "رؤى عن المتقدمين" : "Applicant Insights"}
                  </h3>
                  <ul className="list-disc ms-5 space-y-1 text-sm">
                    {result.applicant_insights.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Job insights */}
            {result.job_insights && result.job_insights.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <Briefcase className="w-4 h-4" />
                    {lang === "ar" ? "رؤى عن الوظائف" : "Job Insights"}
                  </h3>
                  <ul className="list-disc ms-5 space-y-1 text-sm">
                    {result.job_insights.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <Card className="bg-muted/40">
                <CardContent className="p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4" />
                    {lang === "ar" ? "التوصيات" : "Recommendations"}
                  </h3>
                  <ul className="list-disc ms-5 space-y-1 text-sm">
                    {result.recommendations.map((h, i) => <li key={i}>{h}</li>)}
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

export default AiInsightsPanel;
