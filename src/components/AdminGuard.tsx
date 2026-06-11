import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    const checkUser = async (userId: string) => {
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      setStatus(role?.role ? "allowed" : "denied");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user?.id) {
        setStatus("denied");
      } else {
        checkUser(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );

  if (status === "denied") return <Navigate to="/admin/login" replace />;

  return <>{children}</>;
};

export default AdminGuard;
