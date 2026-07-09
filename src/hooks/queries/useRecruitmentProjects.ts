import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Mirrors the original `fetchAll()`'s `recruitment_projects` read in
 * RecruitmentDashboard.tsx. Shared with TransferToRecruitmentDialog, which
 * filters to `is_active` rows client-side.
 */
async function fetchRecruitmentProjects() {
  const { data, error } = await supabase
    .from("recruitment_projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function useRecruitmentProjectsQuery() {
  return useQuery({
    queryKey: queryKeys.recruitmentProjects.list(),
    queryFn: fetchRecruitmentProjects,
  });
}

/**
 * Insert when `id` is absent, update when present — mirrors the original
 * `saveProject()`'s `p.id ? update : insert` branch.
 */
export function useSaveRecruitmentProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const { error } = id
        ? await supabase.from("recruitment_projects").update(payload).eq("id", id)
        : await supabase.from("recruitment_projects").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recruitmentProjects.all });
    },
  });
}

export function useDeleteRecruitmentProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recruitment_projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recruitmentProjects.all });
      // Deleting a project cascades to its job titles/candidates server-side.
      queryClient.invalidateQueries({ queryKey: queryKeys.recruitmentJobTitles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.recruitmentCandidates.all });
    },
  });
}
