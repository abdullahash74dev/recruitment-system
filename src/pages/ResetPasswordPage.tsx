import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import logo from "@/assets/logo.jpg";

const ResetPasswordPage = () => {
  const { t, dir } = useLanguage();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
      // If user has a session (from recovery link), allow password update
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "PASSWORD_RECOVERY")) {
        setReady(true);
      }
    });

    // Check hash for recovery type
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    }

    // Check URL search params (some flows use query params)
    const params = new URLSearchParams(window.location.search);
    if (params.get("type") === "recovery") {
      setReady(true);
    }

    // Also check if there's already a valid session (user clicked recovery link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUpdate = async () => {
    if (!password || !confirmPassword) { toast.error(t("validation.required")); return; }
    if (password !== confirmPassword) { toast.error(t("admin.passwordMismatch")); return; }
    if (password.length < 6) { toast.error(t("admin.passwordTooShort")); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(t("admin.resetError"));
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/admin/login"), 3000);
    }
    setLoading(false);
  };

  if (!ready && !success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir={dir}>
        <Card className="w-full max-w-md mx-4">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t("admin.invalidResetLink")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center" dir={dir}>
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <img src={logo} alt="AlKholi Group" className="h-16 mx-auto mb-4 object-contain" />
          <CardTitle className="text-2xl">{t("admin.newPassword")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">{t("admin.passwordUpdated")}</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("admin.newPasswordLabel")}</label>
                <Input value={password} onChange={e => setPassword(e.target.value)} type="password" dir="ltr" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("admin.confirmPassword")}</label>
                <Input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" dir="ltr" onKeyDown={e => e.key === "Enter" && handleUpdate()} />
              </div>
              <Button onClick={handleUpdate} className="w-full gradient-primary text-primary-foreground" disabled={loading}>
                {loading ? "..." : t("admin.updatePassword")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
