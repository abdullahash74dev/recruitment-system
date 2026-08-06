import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export default function ClientPortalLoginPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/client-portal");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4" dir={ar ? "rtl" : "ltr"}>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <Search className="w-8 h-8 mx-auto text-primary" />
          <CardTitle>{ar ? "بوابة البحث عن المرشحين" : "Candidate Search Portal"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{ar ? "البريد الإلكتروني" : "Email"}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{ar ? "كلمة المرور" : "Password"}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {ar ? "تسجيل الدخول" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
