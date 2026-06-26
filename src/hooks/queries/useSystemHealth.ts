import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface BucketUsage {
  bucket_id: string;
  object_count: number;
  total_bytes: number;
}

export interface TableSize {
  table_name: string;
  total_bytes: number;
  row_estimate: number;
}

export interface SystemUsage {
  plan: string | null;
  db: { used_bytes: number; limit_bytes: number | null };
  storage: { used_bytes: number; limit_bytes: number | null; buckets: BucketUsage[] };
  biggest_tables: TableSize[];
  fetched_at: string;
}

export interface ErrorLogRow {
  id: string;
  severity: string;
  source: string;
  message: string;
  stack: string | null;
  context: unknown;
  url: string | null;
  user_email: string | null;
  created_at: string;
}

async function callSystemHealth<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("system-health", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function useSystemUsageQuery() {
  return useQuery({
    queryKey: queryKeys.systemHealth.usage(),
    queryFn: () => callSystemHealth<SystemUsage>({ action: "get_usage" }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    meta: { persist: false },
  });
}

export function useErrorLogQuery(filters: { severity?: string; source?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.errorLog.list(filters),
    queryFn: () =>
      callSystemHealth<{ rows: ErrorLogRow[]; total: number }>({ action: "get_errors", ...filters }),
    staleTime: 30_000,
    meta: { persist: false },
  });
}
