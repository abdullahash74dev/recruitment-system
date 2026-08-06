import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

/**
 * Gates /client-portal to an authenticated user with an ACTIVE client_users
 * row. Deliberately does not reuse AdminGuard: a client account must never be
 * treated as authorized just for holding *some* row in user_roles — it must
 * specifically be an active client_users member, checked directly (not via
 * the 'client' app_role alone, since that enum value only marks intent —
 * client_users.is_active is the actual on/off switch admins use to suspend
 * a single user without touching their whole organization).
 */
const ClientPortalGuard = ({ children }: { children: React.ReactNode }) => {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [status, setStatus] = useState<"loading" | "allowed" | "denied" | "unauthorized">("loading");

  useEffect(() => {
    let mounted = true;

    const checkUser = async (userId: string) => {
      const { data, error } = await (supabase as any)
        .from("client_users")
        .select("is_active")
        .eq("user_id", userId)
        .maybeSingle();
      if (!mounted) return;
      if (error || !data || !data.is_active) {
        setStatus("unauthorized");
        return;
      }
      setStatus("allowed");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user?.id) {
        setStatus("denied");
        return;
      }
      setTimeout(() => checkUser(session.user.id), 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (status === "denied") return <Navigate to="/client-portal/login" replace />;

  if (status === "unauthorized") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">{ar ? "لا يوجد صلاحية وصول" : "No Access"}</h1>
          <p className="text-muted-foreground">
            {ar ? "هذا الحساب غير مفعّل كمستخدم بوابة عملاء." : "This account is not an active client portal user."}
          </p>
          <Button onClick={() => supabase.auth.signOut()}>{ar ? "تسجيل خروج" : "Sign out"}</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ClientPortalGuard;
