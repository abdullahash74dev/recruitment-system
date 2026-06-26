import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface AuditRow {
  id: string;
  occurred_at: string;
  user_email: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  summary: string | null;
  old_data: any;
  new_data: any;
  ip_address: string | null;
  user_agent: string | null;
}

async function fetchAuditLog(): Promise<AuditRow[]> {
  const { data, error } = await (supabase as any)
    .from("audit_log")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

export function useAuditLogQuery() {
  return useQuery({
    queryKey: queryKeys.auditLog.list(),
    queryFn: fetchAuditLog,
    meta: { persist: false },
  });
}
