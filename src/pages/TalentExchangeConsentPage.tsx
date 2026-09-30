import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Briefcase, Wallet, MapPin } from "lucide-react";
import SiteLogo from "@/components/SiteLogo";

interface ListingPreview {
  position_title: string;
  job_level: string | null;
  current_salary: number | null;
  current_work_location: string | null;
  release_reason_category: string;
  consent_status: "pending" | "confirmed" | "declined";
  status: string;
}

const REASON_LABELS: Record<string, string> = {
  cost_reduction: "تقليص التكاليف",
  restructuring: "إعادة هيكلة",
  contract_end: "انتهاء العقد",
  relocation: "نقل موقع العمل",
  other: "سبب آخر",
};

type Phase = "loading" | "invalid" | "expired" | "ready" | "already_decided" | "submitting" | "done";

export default function TalentExchangeConsentPage() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [listing, setListing] = useState<ListingPreview | null>(null);
  const [finalDecision, setFinalDecision] = useState<"confirmed" | "declined" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error: err } = await supabase.functions.invoke("talent-exchange-consent", {
        body: { token, action: "view" },
      });
      if (err || data?.error) {
        const code = data?.error;
        setPhase(code === "expired_token" ? "expired" : "invalid");
        return;
      }
      if (data.consent_status !== "pending") {
        setListing(data);
        setFinalDecision(data.consent_status);
        setPhase("already_decided");
        return;
      }
      setListing(data);
      setPhase("ready");
    })();
  }, [token]);

  const decide = async (decision: "confirmed" | "declined") => {
    setPhase("submitting");
    const { data, error: err } = await supabase.functions.invoke("talent-exchange-consent", {
      body: { token, action: "decide", decision },
    });
    if (err || data?.error) {
      setError(data?.error || "حدث خطأ، حاول مرة أخرى");
      setPhase("ready");
      return;
    }
    setFinalDecision(decision);
    setPhase("done");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center"><SiteLogo heightOverride={48} /></div>
          <CardTitle className="text-xl">موافقتك على مشاركة بياناتك الوظيفية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {phase === "loading" && (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              جارٍ التحميل...
            </div>
          )}

          {phase === "invalid" && (
            <p className="text-center text-destructive py-6">الرابط غير صحيح. تأكد من نسخ الرابط كاملاً من رسالة البريد.</p>
          )}

          {phase === "expired" && (
            <p className="text-center text-destructive py-6">انتهت صلاحية هذا الرابط (7 أيام). تواصل مع الشركة إذا رغبت بالمتابعة.</p>
          )}

          {(phase === "ready" || phase === "submitting") && listing && (
            <>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  طلبت جهة عمل مشاركة البيانات التالية <b>بدون اسمك أو بيانات التواصل الخاصة بك</b> مع شركات أخرى قد تكون لديها
                  فرصة عمل مناسبة. لن يظهر اسمك لأي طرف إلا إذا وافقت.
                </p>
                <div className="grid grid-cols-1 gap-1.5 text-sm pt-2 border-t">
                  <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-muted-foreground" /><span>{listing.position_title}{listing.job_level ? ` — ${listing.job_level}` : ""}</span></div>
                  {listing.current_salary != null && (
                    <div className="flex items-center gap-2"><Wallet className="w-4 h-4 text-muted-foreground" /><span>الراتب: {listing.current_salary}</span></div>
                  )}
                  {listing.current_work_location && (
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /><span>{listing.current_work_location}</span></div>
                  )}
                  <Badge variant="outline" className="w-fit mt-1">{REASON_LABELS[listing.release_reason_category] || listing.release_reason_category}</Badge>
                </div>
              </div>

              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              <div className="flex gap-2">
                <Button
                  onClick={() => decide("confirmed")}
                  disabled={phase === "submitting"}
                  className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  أوافق على المشاركة
                </Button>
                <Button
                  onClick={() => decide("declined")}
                  disabled={phase === "submitting"}
                  variant="outline"
                  className="flex-1 gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  لا أوافق
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                قرارك نهائي ولا يمكن تغييره بعد الإرسال
              </p>
            </>
          )}

          {(phase === "already_decided" || phase === "done") && (
            <div className="py-6 text-center space-y-2">
              {finalDecision === "confirmed" ? (
                <>
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <p className="font-medium">تم تسجيل موافقتك بنجاح</p>
                  <p className="text-sm text-muted-foreground">بيانات وظيفتك الآن مرئية (بدون اسمك) للشركات الأخرى.</p>
                </>
              ) : (
                <>
                  <XCircle className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="font-medium">تم تسجيل اعتذارك</p>
                  <p className="text-sm text-muted-foreground">لن تتم مشاركة أي من بياناتك.</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
