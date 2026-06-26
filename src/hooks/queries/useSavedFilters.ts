import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import type { AdvancedFilter } from "@/components/Dashboard/ApplicantsAdvancedFilters";

export interface SavedFilter {
  id: string;
  name: string;
  criteria: AdvancedFilter[];
  result_count: number | null;
  created_by: string | null;
  created_at: string;
}

/**
 * Mirrors the original `loadSavedFilters()` in ApplicantsAdvancedFilters.tsx:
 * same table, same `.select("*")`/`.order("created_at", { ascending: false })`.
 */
async function fetchSavedFilters(): Promise<SavedFilter[]> {
  const { data } = await supabase.from("saved_filters").select("*").order("created_at", { ascending: false });
  return (data || []) as unknown as SavedFilter[];
}

export function useSavedFiltersQuery() {
  return useQuery({
    queryKey: queryKeys.savedFilters.list(),
    queryFn: fetchSavedFilters,
  });
}

export interface SaveFilterInput {
  name: string;
  criteria: AdvancedFilter[];
  result_count: number;
  created_by: string | undefined;
}

/**
 * Mirrors the original `saveCurrentFilter()` insert body.
 */
export function useSaveFilterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveFilterInput) => {
      const { error } = await supabase.from("saved_filters").insert({
        name: input.name, criteria: input.criteria as any, result_count: input.result_count, created_by: input.created_by,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedFilters.all });
    },
  });
}

/**
 * Mirrors the original `deleteSavedFilter()` body (minus the `confirm()`
 * dialog, which stays at the call site).
 */
export function useDeleteSavedFilterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_filters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedFilters.all });
    },
  });
}
