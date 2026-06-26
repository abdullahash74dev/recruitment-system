import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Fetches all recruitment candidates, optionally narrowed by project.
 * Mirrors the original `supabase.from("recruitment_candidates").select("*")...`
 * call that used to live inline in RecruitmentDashboard's fetchAll().
 */
export function useRecruitmentCandidatesQuery(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.recruitmentCandidates.list(projectId),
    queryFn: async () => {
      let query = supabase
        .from("recruitment_candidates")
        .select("*")
        .order("created_at", { ascending: false });
      if (projectId && projectId !== "all") {
        query = query.eq("project_id", projectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Create or update a candidate. Mirrors the original saveCandidate() logic:
 * insert when no id is present, update (by id) otherwise.
 */
export function useSaveCandidateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (candidate: Record<string, any>) => {
      const { id, ...payload } = candidate;
      const op = id
        ? supabase.from("recruitment_candidates").update(payload).eq("id", id)
        : supabase.from("recruitment_candidates").insert(payload);
      const { error } = await op;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recruitmentCandidates.all });
    },
  });
}

/** Deletes a candidate by id. Mirrors the original deleteCandidate(). */
export function useDeleteCandidateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recruitment_candidates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recruitmentCandidates.all });
    },
  });
}

/**
 * Updates arbitrary fields on a candidate (status + auto-stamped date fields).
 * Mirrors the original changeStatus() update call.
 */
export function useUpdateCandidateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("recruitment_candidates").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recruitmentCandidates.all });
    },
  });
}

/**
 * Bulk-inserts applicants as new recruitment candidates.
 * Mirrors the original TransferToRecruitmentDialog `handleTransfer()` insert.
 */
export function useTransferApplicantsToRecruitmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Record<string, unknown>[]) => {
      const { error } = await supabase.from("recruitment_candidates").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recruitmentCandidates.all });
    },
  });
}

/**
 * Marks a candidate as rejected with a reason/note.
 * Mirrors the original confirmReject() update call.
 */
export function useRejectCandidateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reasonId, note }: { id: string; reasonId: string; note: string | null }) => {
      const { error } = await supabase
        .from("recruitment_candidates")
        .update({ status: "rejected", rejected_reason_id: reasonId, rejected_note: note })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recruitmentCandidates.all });
    },
  });
}
