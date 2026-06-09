import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "LOGIN" | "LOGOUT" | "LOGIN_FAILED" | "CUSTOM" | "EXPORT" | "IMPORT";

interface LogParams {
  action: AuditAction;
  summary: string;
  table_name?: string;
  record_id?: string;
  metadata?: Record<string, any>;
}

/**
 * Logs a custom event to the audit log. Database INSERT/UPDATE/DELETE events
 * are captured automatically via triggers — use this only for app-level events.
 */
export const logAudit = async ({ action, summary, table_name, record_id, metadata }: LogParams) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;

    let user_email: string | null = null;
    if (user) {
      const { data } = await supabase.from("profiles").select("email").eq("user_id", user.id).maybeSingle();
      user_email = (data as any)?.email ?? user.email ?? null;
    }

    await (supabase as any).from("audit_log").insert({
      action,
      summary,
      table_name: table_name ?? null,
      record_id: record_id ?? null,
      user_id: user?.id ?? null,
      user_email,
      user_agent: ua,
      new_data: metadata ?? null,
    });
  } catch (err) {
    // Fail silently — never block app flow on audit logging
    console.warn("audit log failed", err);
  }
};
