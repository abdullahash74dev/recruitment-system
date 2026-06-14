import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import SiteLogo from "@/components/SiteLogo";
import AuroraBackground from "@/components/AuroraBackground";

export default function AdminLoginPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/admin", { replace: true });
    });
  }, [navigate]);

  const handleLogin = async () => {
    if (!email || !password) { toast.error("يرجى إدخال البريد وكلمة المرور"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("خطأ في البريد الإلكتروني أو كلمة المرور");
      setLoading(false);
      return;
    }
    navigate("/admin", { replace: true });
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <AuroraBackground />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4"><SiteLogo /></div>
          <CardTitle>{t("admin.login") || "تسجيل الدخول"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="email" placeholder="البريد الإلكتروني" value={email} onChange={e => setEmail(e.target.value)} />
          <Input type="password" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
          <Button onClick={handleLogin} className="w-full" disabled={loading}>
            {loading ? "..." : "دخول"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
