import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export type Scope = "applicants" | "recruitment" | "jobs";

export interface ReportTemplate {
  id: string;
  name: string;
  description: string | null;
  scope: Scope;
  config: any;
}

export interface ReportRun {
  id: string;
  status: string;
  file_url: string | null;
  file_name: string | null;
  run_at: string;
}

/**
 * Mirrors the original `loadTemplates()` in ReportBuilder.tsx:
 * same table, same `.select("*")`/`.order("created_at", { ascending: false })`.
 */
async function fetchReportTemplates(): Promise<ReportTemplate[]> {
  const { data } = await supabase
    .from("report_templates")
    .select("*")
    .order("created_at", { ascending: false });
  return (data || []) as ReportTemplate[];
}

export function useReportTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.reportTemplates.list(),
    queryFn: fetchReportTemplates,
  });
}

/**
 * Mirrors the original `load()` in ScheduledReports.tsx: same table,
 * same `.select("*")`/`.order("run_at", { ascending: false })`/`.limit(10)`.
 */
async function fetchReportRuns(): Promise<ReportRun[]> {
  const { data } = await supabase
    .from("report_runs")
    .select("*")
    .order("run_at", { ascending: false })
    .limit(10);
  return (data as ReportRun[]) || [];
}

export function useReportRunsQuery() {
  return useQuery({
    queryKey: queryKeys.reportTemplates.runs(),
    queryFn: fetchReportRuns,
  });
}

export interface SaveReportTemplateInput {
  name: string;
  description: string | null;
  scope: Scope;
  config: any;
}

/**
 * Mirrors the original `saveTemplate()` body in ReportBuilder.tsx
 * (fetches the current user, then inserts the row with `created_by`).
 */
export function useSaveReportTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveReportTemplateInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("report_templates").insert({
        name: input.name,
        description: input.description,
        scope: input.scope,
        config: input.config,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reportTemplates.list() });
    },
  });
}

/**
 * Mirrors the original `deleteTemplate()` body (minus the `confirm()`
 * dialog, which stays at the call site).
 */
export function useDeleteReportTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reportTemplates.list() });
    },
  });
}

/**
 * Mirrors the original `runNow()` body in ReportBuilder.tsx: invokes the
 * `run-recruitment-report` edge function with the built report config and
 * returns the raw response data so the caller can inspect `data.error`,
 * `file_url`, `insights`, etc. exactly as before.
 */
export function useRunReportTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("run-recruitment-report", {
        body: { config },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reportTemplates.runs() });
    },
  });
}
