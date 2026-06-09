import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import logo from "@/assets/logo.jpg";

const ForgotPasswordPage = () => {
  const { t, dir, lang } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;

  const handleReset = async () => {
    if (!email) { toast.error(t("validation.required")); return; }
    setLoading(true);

    // Always show success to avoid leaking whether the email is registered
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center" dir={dir}>
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <img src={logo} alt="AlKholi Group" className="h-16 mx-auto mb-4 object-contain" />
          <CardTitle className="text-2xl">{t("admin.forgotPassword")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">{t("admin.forgotDesc")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-accent" />
              </div>
              <p className="text-sm text-muted-foreground">{t("admin.resetSent")}</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("dash.email")}</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email" dir="ltr" onKeyDown={e => e.key === "Enter" && handleReset()} />
              </div>
              <Button onClick={handleReset} className="w-full gradient-primary text-primary-foreground" disabled={loading}>
                {loading ? "..." : t("admin.sendReset")}
              </Button>
            </>
          )}
          <div className="flex items-center justify-center gap-2 pt-2">
            <Link to="/admin/login" className="text-sm text-primary hover:underline flex items-center gap-1">
              <BackArrow className="w-3 h-3" />
              {t("admin.backToLogin")}
            </Link>
          </div>
          <div className="flex justify-center pt-2"><TopBar variant="dark" /></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
