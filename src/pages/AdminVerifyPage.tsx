import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import SiteLogo from "@/components/SiteLogo";
import AuroraBackground from "@/components/AuroraBackground";
import { logAudit } from "@/lib/audit";
import { TWO_FACTOR_SESSION_KEY } from "@/components/AdminGuard";

const RESEND_COOLDOWN = 60;

export default function AdminVerifyPage() {
  const { t, dir } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const sendCode = async (targetEmail: string) => {
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { shouldCreateUser: false },
    });
    setSending(false);
    if (error) {
      toast.error(t("admin.otpCodeSendError"));
      return;
    }
    toast.success(t("admin.otpCodeSent"));
    setCooldown(RESEND_COOLDOWN);
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session?.user?.email) {
        navigate("/admin/login", { replace: true });
        return;
      }
      if (sessionStorage.getItem(TWO_FACTOR_SESSION_KEY) === "true") {
        navigate("/admin", { replace: true });
        return;
      }
      setEmail(session.user.email);
      sendCode(session.user.email);
    });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleVerify = async () => {
    if (!email || code.length < 6) return;
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setVerifying(false);
    if (error) {
      logAudit({ action: "LOGIN_FAILED", summary: `Failed email 2FA verification for ${email}` });
      toast.error(t("admin.otpInvalid"));
      setCode("");
      return;
    }
    sessionStorage.setItem(TWO_FACTOR_SESSION_KEY, "true");
    logAudit({ action: "LOGIN", summary: `Completed email 2FA verification for ${email}` });
    navigate("/admin", { replace: true });
  };

  const handleCancel = async () => {
    sessionStorage.removeItem(TWO_FACTOR_SESSION_KEY);
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative" dir={dir}>
      <AuroraBackground />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4"><SiteLogo /></div>
          <ShieldCheck className="w-10 h-10 mx-auto text-primary mb-2" />
          <CardTitle>{t("admin.twoFactorTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {t("admin.twoFactorDesc")}{email ? ` ${email}` : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center" dir="ltr">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button onClick={handleVerify} className="w-full" disabled={verifying || code.length < 6}>
            {verifying ? "..." : t("admin.verifyOtp")}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={handleCancel} className="text-muted-foreground hover:underline">
              {t("dash.logout")}
            </button>
            <button
              type="button"
              onClick={() => email && sendCode(email)}
              disabled={sending || cooldown > 0 || !email}
              className="text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldown > 0 ? `${t("admin.resendCode")} (${cooldown})` : t("admin.resendCode")}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
