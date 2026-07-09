import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

const STALE_AFTER_MS = 2 * 60 * 1000;

/**
 * Last 20 import runs, for the ApplicantsMappedImport history dialog.
 * Mirrors the original `loadJobHistory()` — fetched on demand (dialog open),
 * not on mount.
 */
export function useApplicantImportJobsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.applicantImportJobs.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicant_import_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled,
  });
}

/**
 * Detects an import left "running" by a crashed/closed tab. Mirrors the
 * original mount-on-open effect that checked for a stale `status: "running"` row.
 */
export function useStaleImportJobQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.applicantImportJobs.staleCheck(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicant_import_jobs")
        .select("*")
        .eq("status", "running")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const job = data?.[0];
      return job && Date.now() - new Date(job.updated_at).getTime() > STALE_AFTER_MS ? job : null;
    },
    enabled,
  });
}
