import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

async function fetchProjects(): Promise<any[]> {
  const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function useProjectsQuery() {
  return useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: fetchProjects,
  });
}

/**
 * Insert when `id` is absent, update when present — mirrors the original
 * `saveProject`'s `editingProjectId ? update : insert` branch.
 */
export function useSaveProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string | null; payload: Record<string, unknown> }) => {
      const { error } = id
        ? await supabase.from("projects").update(payload).eq("id", id)
        : await supabase.from("projects").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useToggleProjectActiveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("projects").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}
