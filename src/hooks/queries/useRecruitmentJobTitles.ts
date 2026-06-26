import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Mirrors the original `fetchAll()`'s `recruitment_job_titles` read in
 * RecruitmentDashboard.tsx. Shared with TransferToRecruitmentDialog, which
 * filters to `is_active` rows client-side.
 */
async function fetchRecruitmentJobTitles() {
  const { data, error } = await supabase
    .from("recruitment_job_titles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function useRecruitmentJobTitlesQuery() {
  return useQuery({
    queryKey: queryKeys.recruitmentJobTitles.list(),
    queryFn: fetchRecruitmentJobTitles,
  });
}

/**
 * `recruitment_job_title_stats` is a DB view aggregating headcount/hire
 * progress per job title. Mirrors the original `fetchAll()`'s `s` read.
 */
async function fetchJobTitleStats() {
  const { data, error } = await supabase.from("recruitment_job_title_stats").select("*");
  if (error) throw error;
  return data ?? [];
}

export function useJobTitleStatsQuery() {
  return useQuery({
    queryKey: queryKeys.recruitmentJobTitles.stats(),
    queryFn: fetchJobTitleStats,
  });
}

/**
 * Insert when `id` is absent, update when present — mirrors the original
 * `saveJob()`'s `j.id ? update : insert` branch.
 */
export function useSaveRecruitmentJobTitleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const { error } = id
        ? await supabase.from("recruitment_job_titles").update(payload).eq("id", id)
        : await supabase.from("recruitment_job_titles").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recruitmentJobTitles.all });
    },
  });
}

export function useDeleteRecruitmentJobTitleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recruitment_job_titles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recruitmentJobTitles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.recruitmentCandidates.all });
    },
  });
}
