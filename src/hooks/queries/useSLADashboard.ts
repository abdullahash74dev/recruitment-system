import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface SLAConfig {
  id: string;
  stage: string;
  target_days: number;
  warning_days: number;
  updated_at: string;
}

export interface StageMetric {
  stage: string;
  count: number;
  avgDays: number;
  targetDays: number;
  warningDays: number;
  breachCount: number;
}

export interface SLAMetrics {
  stages: StageMetric[];
  avgTimeToHire: number;
  hiredCount: number;
  totalApplicants: number;
  conversionRate: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function useSLAConfigQuery() {
  return useQuery({
    queryKey: queryKeys.slaDashboard.config(),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sla_config").select("*").order("stage");
      if (error) throw error;
      return (data ?? []) as SLAConfig[];
    },
  });
}

export function useUpdateSLAConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, target_days, warning_days }: { id: string; target_days: number; warning_days: number }) => {
      const { error } = await (supabase as any)
        .from("sla_config")
        .update({ target_days, warning_days, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.slaDashboard.all });
      toast.success("تم تحديث الهدف");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Time-in-stage is derived client-side: the applicants table stores only
 * `created_at` and the current `status`, so "days in stage" is measured from
 * creation to now for anyone still in that stage. Hired applicants give us the
 * end-to-end time-to-hire figure.
 */
export function useSLAMetricsQuery(periodDays: number) {
  const configQuery = useSLAConfigQuery();
  return useQuery({
    queryKey: [...queryKeys.slaDashboard.metrics(), periodDays, configQuery.data?.length ?? 0],
    enabled: !configQuery.isLoading,
    queryFn: async (): Promise<SLAMetrics> => {
      const since = new Date(Date.now() - periodDays * DAY_MS).toISOString();
      const { data, error } = await supabase
        .from("applicants")
        .select("id, status, created_at")
        .gte("created_at", since);
      if (error) throw error;
      const rows = (data ?? []) as { id: string; status: string; created_at: string }[];
      const configs = configQuery.data ?? [];
      const now = Date.now();

      const byStage = new Map<string, number[]>();
      for (const r of rows) {
        const days = (now - new Date(r.created_at).getTime()) / DAY_MS;
        const list = byStage.get(r.status) ?? [];
        list.push(days);
        byStage.set(r.status, list);
      }

      const stages: StageMetric[] = configs.map((c) => {
        const days = byStage.get(c.stage) ?? [];
        const avg = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
        return {
          stage: c.stage,
          count: days.length,
          avgDays: Math.round(avg * 10) / 10,
          targetDays: c.target_days,
          warningDays: c.warning_days,
          breachCount: days.filter((d) => d > c.target_days).length,
        };
      });

      const hired = rows.filter((r) => r.status === "hired");
      const hireDays = hired.map((r) => (now - new Date(r.created_at).getTime()) / DAY_MS);
      const avgTimeToHire = hireDays.length
        ? Math.round((hireDays.reduce((a, b) => a + b, 0) / hireDays.length) * 10) / 10
        : 0;

      return {
        stages,
        avgTimeToHire,
        hiredCount: hired.length,
        totalApplicants: rows.length,
        conversionRate: rows.length ? Math.round((hired.length / rows.length) * 1000) / 10 : 0,
      };
    },
  });
}
