import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface ScheduledReportRun {
  id: string;
  status: string;
  file_url: string | null;
  file_name: string | null;
  run_at: string;
}

/**
 * Mirrors the original `load()` in ScheduledReports.tsx: same table,
 * same `.select("*")`/`.order("run_at", { ascending: false })`/`.limit(10)`.
 */
async function fetchScheduledReportRuns(): Promise<ScheduledReportRun[]> {
  const { data } = await supabase
    .from("report_runs")
    .select("*")
    .order("run_at", { ascending: false })
    .limit(10);
  return (data as ScheduledReportRun[]) || [];
}

export function useScheduledReportRunsQuery() {
  return useQuery({
    queryKey: queryKeys.scheduledReports.list(),
    queryFn: fetchScheduledReportRuns,
  });
}

/**
 * Mirrors the original `runNow()` body in ScheduledReports.tsx: invokes
 * the `run-recruitment-report` edge function in "excel" format and
 * returns the raw response data so the caller can open `file_url`, etc.
 */
export function useRunScheduledReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("run-recruitment-report", {
        body: { format: "excel" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledReports.list() });
    },
  });
}
