import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface RejectionReason {
  id: string;
  reason_ar: string;
  reason_en: string | null;
  is_active: boolean;
  sort_order: number;
}

/**
 * Fetches the full (active + inactive) row set so the admin editor
 * (RejectionReasonsSettings) and read-only consumers (RecruitmentDashboard,
 * ApplicantEmailDialog — both of which only want `is_active` rows) share one
 * cache; each consumer filters client-side to its own needs.
 */
async function fetchRejectionReasons(): Promise<RejectionReason[]> {
  const { data, error } = await supabase.from("rejection_reasons").select("*").order("sort_order");
  if (error) throw error;
  return (data || []) as RejectionReason[];
}

export function useRejectionReasonsQuery() {
  return useQuery({
    queryKey: queryKeys.rejectionReasons.list(),
    queryFn: fetchRejectionReasons,
  });
}

export interface NewRejectionReasonInput {
  reason_ar: string;
  reason_en: string | null;
  sort_order: number;
}

/** Mirrors the original RejectionReasonsSettings `add()` insert body. */
export function useAddRejectionReasonMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewRejectionReasonInput) => {
      const { error } = await supabase.from("rejection_reasons").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rejectionReasons.all });
    },
  });
}

/** Mirrors the original RejectionReasonsSettings `update()` body. */
export function useUpdateRejectionReasonMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<RejectionReason> }) => {
      const { error } = await supabase.from("rejection_reasons").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rejectionReasons.all });
    },
  });
}

/** Mirrors the original RejectionReasonsSettings `remove()` body. */
export function useDeleteRejectionReasonMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rejection_reasons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rejectionReasons.all });
    },
  });
}
