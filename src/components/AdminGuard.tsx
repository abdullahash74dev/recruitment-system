import { useState, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { fetchSiteSettings } from "@/hooks/useSiteSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const TWO_FACTOR_SESSION_KEY = "admin_2fa_verified";

// Auto sign-out after 20 minutes of inactivity, with a 1-minute warning
// before the session ends, so an unattended admin session can't be hijacked.
const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000;

const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<"loading" | "allowed" | "denied" | "unauthorized" | "needs2fa">("loading");
  const [idleSecondsLeft, setIdleSecondsLeft] = useState<number | null>(null);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    let mounted = true;

    const checkUser = async (userId: string) => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (!mounted) return;
      if (!roles || roles.length === 0) {
        setStatus("unauthorized");
        return;
      }

      const settings = await fetchSiteSettings();
      if (!mounted) return;
      if (settings.two_factor_enabled && sessionStorage.getItem(TWO_FACTOR_SESSION_KEY) !== "true") {
        setStatus("needs2fa");
        return;
      }
      setStatus("allowed");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user?.id) {
        sessionStorage.removeItem(TWO_FACTOR_SESSION_KEY);
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

  // Idle session timeout: only tracked once the admin is fully authenticated.
  useEffect(() => {
    if (status !== "allowed") return;

    lastActivityRef.current = Date.now();

    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, markActivity, { passive: true }));

    const interval = setInterval(() => {
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivityRef.current);

      if (remaining <= 0) {
        setIdleSecondsLeft(null);
        sessionStorage.removeItem(TWO_FACTOR_SESSION_KEY);
        supabase.auth.signOut();
        toast.error(t("admin.idleLoggedOutToast"));
      } else if (remaining <= IDLE_WARNING_MS) {
        setIdleSecondsLeft(Math.ceil(remaining / 1000));
      } else {
        setIdleSecondsLeft(null);
      }
    }, 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActivity));
      clearInterval(interval);
    };
  }, [status, t]);

  const staySignedIn = () => {
    lastActivityRef.current = Date.now();
    setIdleSecondsLeft(null);
  };

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );

  if (status === "denied") return <Navigate to="/admin/login" replace />;

  if (status === "needs2fa") return <Navigate to="/admin/verify" replace />;

  if (status === "unauthorized") return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-2xl font-bold">{t("admin.noAccess")}</h1>
        <p className="text-muted-foreground">{t("admin.noAccessDesc")}</p>
        <Button onClick={() => supabase.auth.signOut()}>{t("dash.logout")}</Button>
      </div>
    </div>
  );

  return (
    <>
      {children}
      <Dialog open={idleSecondsLeft !== null} onOpenChange={(open) => !open && staySignedIn()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.idleWarningTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.idleWarningDesc").replace("{seconds}", String(idleSecondsLeft ?? 0))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={staySignedIn}>{t("admin.idleStaySignedIn")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminGuard;
