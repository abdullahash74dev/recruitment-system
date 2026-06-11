import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<"loading" | "allowed" | "denied" | "unauthorized">("loading");

  useEffect(() => {
    let mounted = true;

    const checkUser = async (userId: string) => {
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (!mounted) return;
      setStatus(role?.role ? "allowed" : "unauthorized");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user?.id) {
        setStatus("denied");
        return;
      }
      // Defer Supabase calls to avoid deadlocking the auth client,
      // which can happen when querying from inside this callback.
      setTimeout(() => checkUser(session.user.id), 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );

  if (status === "denied") return <Navigate to="/admin/login" replace />;

  if (status === "unauthorized") return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-bold">{t("admin.noAccess")}</h1>
        <p className="text-muted-foreground">{t("admin.noAccessDesc")}</p>
        <Button onClick={() => supabase.auth.signOut()}>{t("dash.logout")}</Button>
      </div>
    </div>
  );

  return <>{children}</>;
};

export default AdminGuard;
