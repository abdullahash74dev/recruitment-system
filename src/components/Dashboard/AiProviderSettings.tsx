import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, CheckCircle2, XCircle, RefreshCw, KeyRound, Sparkles } from "lucide-react";

interface ProviderStatus {
  gemini_configured: boolean;
  anthropic_configured: boolean;
}

const AiProviderSettings = () => {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const [provider, setProvider] = useState<"gemini" | "claude">("gemini");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const loadSettings = async () => {
    const { data } = await supabase.from("ai_settings").select("id, provider").limit(1).maybeSingle();
    if (data) {
      setSettingsId(data.id);
      setProvider((data.provider as "gemini" | "claude") || "gemini");
    }
  };

  const loadStatus = async () => {
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-provider-status");
      if (error) throw error;
      setStatus(data as ProviderStatus);
    } catch {
      setStatus(null);
    }
    setCheckingStatus(false);
  };

  useEffect(() => {
    (async () => {
      await Promise.all([loadSettings(), loadStatus()]);
      setLoading(false);
    })();
  }, []);

  const handleChange = async (value: string) => {
    const next = value as "gemini" | "claude";
    if (next === provider) return;
    if (next === "claude" && !status?.anthropic_configured) {
      toast.error(
        isAr
          ? "يجب إضافة مفتاح ANTHROPIC_API_KEY من إعدادات Supabase أولاً قبل التفعيل"
          : "Add the ANTHROPIC_API_KEY secret in Supabase before enabling Claude"
      );
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { provider: next, updated_by: user?.id || null, updated_at: new Date().toISOString() };
    const { error } = settingsId
      ? await supabase.from("ai_settings").update(payload).eq("id", settingsId)
      : await supabase.from("ai_settings").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(isAr ? "تعذر حفظ الإعداد" : "Failed to save setting");
      return;
    }
    setProvider(next);
    toast.success(isAr ? "تم تحديث مزود الذكاء الاصطناعي" : "AI provider updated");
    loadSettings();
  };

  const StatusBadge = ({ ok }: { ok: boolean | undefined }) => (
    <Badge variant="secondary" className={ok ? "bg-green-500/15 text-green-700 dark:text-green-400 gap-1" : "bg-muted text-muted-foreground gap-1"}>
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {ok ? (isAr ? "مفعّل" : "Configured") : (isAr ? "غير مفعّل" : "Not configured")}
    </Badge>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bot className="w-5 h-5" />
        <h3 className="text-lg font-bold">{isAr ? "إعدادات مزود الذكاء الاصطناعي" : "AI Provider Settings"}</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        {isAr
          ? "يستخدم النظام Google Gemini كخيار افتراضي (الأرخص والأكفأ). يمكنك التبديل إلى Anthropic Claude بعد ربط مفتاح API الخاص به من إعدادات Supabase."
          : "The system defaults to Google Gemini (cheapest and most efficient). You can switch to Anthropic Claude once its API key is connected via Supabase secrets."}
      </p>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            {isAr ? "حالة مفاتيح الربط" : "API Key Status"}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadStatus} disabled={checkingStatus} className="gap-1">
            <RefreshCw className={`w-3 h-3 ${checkingStatus ? "animate-spin" : ""}`} />
            {isAr ? "تحديث" : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Google Gemini</span>
            <StatusBadge ok={status?.gemini_configured} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Anthropic Claude</span>
            <StatusBadge ok={status?.anthropic_configured} />
          </div>
          {!status?.anthropic_configured && (
            <p className="text-xs text-muted-foreground pt-1">
              {isAr
                ? "لإضافة Claude: أضف Secret باسم ANTHROPIC_API_KEY في إعدادات Edge Functions في Supabase، ثم اضغط تحديث."
                : "To add Claude: add a secret named ANTHROPIC_API_KEY in your Supabase Edge Functions settings, then click Refresh."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {isAr ? "المزود النشط" : "Active Provider"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={provider} onValueChange={handleChange} disabled={loading || saving}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">{isAr ? "Google Gemini (موصى به - الأرخص)" : "Google Gemini (recommended - cheapest)"}</SelectItem>
              <SelectItem value="claude">Anthropic Claude</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "عند التبديل، تنتقل جميع ميزات الذكاء الاصطناعي في النظام (الفلترة، تحليل السير الذاتية، التقارير، طبيب النظام...) لاستخدام المزود الجديد تلقائياً دون أي تعديل إضافي."
              : "Switching this updates every AI feature in the system (filtering, resume parsing, reports, system doctor...) to use the new provider automatically, with no extra changes."}
          </p>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "ملاحظة: ميزة إزالة خلفية الشعار تستخدم Gemini دائماً لأنها تتطلب توليد صور، وهي ميزة غير متوفرة في Claude."
              : "Note: logo background removal always uses Gemini since it requires image generation, which Claude does not support."}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{isAr ? "مقارنة الأسعار (لكل مليون رمز)" : "Pricing Comparison (per 1M tokens)"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-start py-1 pe-4">{isAr ? "النموذج" : "Model"}</th>
                  <th className="text-start py-1 pe-4">{isAr ? "الإدخال" : "Input"}</th>
                  <th className="text-start py-1">{isAr ? "الإخراج" : "Output"}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-muted">
                  <td className="py-1 pe-4">Gemini 2.5 Flash-Lite</td>
                  <td className="py-1 pe-4">$0.10</td>
                  <td className="py-1">$0.40</td>
                </tr>
                <tr className="border-b border-muted">
                  <td className="py-1 pe-4">Gemini 2.5 Flash</td>
                  <td className="py-1 pe-4">$0.30</td>
                  <td className="py-1">$2.50</td>
                </tr>
                <tr className="border-b border-muted">
                  <td className="py-1 pe-4">Gemini 2.5 Pro</td>
                  <td className="py-1 pe-4">$1.25</td>
                  <td className="py-1">$10.00</td>
                </tr>
                <tr className="border-b border-muted">
                  <td className="py-1 pe-4">Claude Haiku 4.5</td>
                  <td className="py-1 pe-4">$1.00</td>
                  <td className="py-1">$5.00</td>
                </tr>
                <tr>
                  <td className="py-1 pe-4">Claude Sonnet 4.6</td>
                  <td className="py-1 pe-4">$3.00</td>
                  <td className="py-1">$15.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AiProviderSettings;
