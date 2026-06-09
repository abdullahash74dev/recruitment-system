import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Mail, ExternalLink } from "lucide-react";
import logo from "@/assets/logo.jpg";
import { logAudit } from "@/lib/audit";

const AdminLoginPage = () => {
  const { t, dir } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"credentials" | "waiting">("credentials");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [resendTimer, setResendTimer] = useState(0);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !isLoggingIn) {
        navigate("/admin", { replace: true });
      }
      // If we're in waiting step and session arrives (magic link clicked), navigate
      if (session && isLoggingIn && step === "waiting") {
        setIsLoggingIn(false);
        navigate("/admin", { replace: true });
      }
      setChecking(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !isLoggingIn) navigate("/admin", { replace: true });
      setChecking(false);
    });
    return () => subscription.unsubscribe();
  }, [navigate, step, isLoggingIn]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((v) => v - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleLogin = async () => {
    if (!email || !password) { toast.error(t("validation.required")); return; }
    setLoading(true);
    setIsLoggingIn(true);

    // Step 1: Verify credentials (generic error on failure to avoid email enumeration)
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // log failed attempt as anon (user_id null)
      await (supabase as any).from("audit_log").insert({
        action: "LOGIN_FAILED",
        summary: `Failed login attempt for ${email}`,
        user_email: email,
        user_agent: navigator.userAgent,
      });
      toast.error(t("dash.loginError"));
      setLoading(false);
      setIsLoggingIn(false);
      return;
    }
    // log success (current session is still active before signOut)
    await logAudit({ action: "LOGIN", summary: `Successful login for ${email}` });

    // Step 2: Sign out and send magic link for 2FA
    await supabase.auth.signOut();

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/admin`,
      },
    });

    if (otpError) {
      toast.error(t("admin.otpSendError"));
      setLoading(false);
      setIsLoggingIn(false);
      return;
    }

    toast.success(t("admin.otpSent"));
    setStep("waiting");
    setResendTimer(60);
    setLoading(false);
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/admin`,
      },
    });

    if (error) {
      toast.error(t("admin.otpSendError"));
    } else {
      toast.success(t("admin.otpSent"));
      setResendTimer(60);
    }
    setLoading(false);
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center" dir={dir}>
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <img src={logo} alt="AlKholi Group" className="h-16 mx-auto mb-4 object-contain" />
          <CardTitle className="text-2xl">{t("dash.login")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {step === "credentials" ? t("admin.loginDesc") : t("admin.magicLinkDesc")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "credentials" ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("dash.email")}</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email" dir="ltr" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("dash.password")}</label>
                <Input value={password} onChange={e => setPassword(e.target.value)} type="password" dir="ltr" onKeyDown={e => e.key === "Enter" && handleLogin()} />
              </div>
              <Button onClick={handleLogin} className="w-full gradient-primary text-primary-foreground gap-2" disabled={loading}>
                {loading ? "..." : (
                  <>
                    <Shield className="w-4 h-4" />
                    {t("dash.loginBtn")}
                  </>
                )}
              </Button>
              <div className="flex justify-center">
                <Link to="/admin/forgot-password" className="text-sm text-primary hover:underline">
                  {t("admin.forgotPassword")}
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-lg mb-4">
                <Mail className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">{email}</span>
              </div>

              <div className="flex flex-col items-center gap-3 p-6 border rounded-lg bg-muted/30">
                <ExternalLink className="w-10 h-10 text-primary" />
                <p className="text-sm text-center text-muted-foreground">
                  {t("admin.checkEmailForLink")}
                </p>
                <p className="text-xs text-center text-muted-foreground">
                  {t("admin.clickLinkToLogin")}
                </p>
              </div>

              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || loading}
                  className="text-sm"
                >
                  {resendTimer > 0
                    ? `${t("admin.resendOtp")} (${resendTimer}s)`
                    : t("admin.resendOtp")}
                </Button>
              </div>

              <div className="flex justify-center">
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => { setStep("credentials"); setIsLoggingIn(false); }}
                  className="text-sm text-muted-foreground"
                >
                  {t("admin.backToLogin")}
                </Button>
              </div>
            </>
          )}

          <div className="flex justify-center pt-2"><TopBar variant="dark" /></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLoginPage;
