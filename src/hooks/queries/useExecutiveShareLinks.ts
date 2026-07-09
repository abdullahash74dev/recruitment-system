import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/** Mirrors the original `fetchAll()`'s `executive_share_links` read. */
async function fetchExecutiveShareLinks() {
  const { data, error } = await supabase
    .from("executive_share_links")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function useExecutiveShareLinksQuery() {
  return useQuery({
    queryKey: queryKeys.executiveShareLinks.list(),
    queryFn: fetchExecutiveShareLinks,
  });
}

export interface NewShareLinkInput {
  token: string;
  label: string;
  created_by: string | undefined;
  created_by_email: string | undefined;
}

/**
 * Mirrors the original inline insert in the "New link" button handler.
 * Returns the created row so the caller can auto-open its permissions popover.
 */
export function useCreateShareLinkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewShareLinkInput) => {
      const { data, error } = await supabase.from("executive_share_links").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.executiveShareLinks.all });
    },
  });
}

/**
 * Generic patch — covers the is_active toggle and the DefaultPrefsPopover's
 * `default_prefs` save, both of which were separate inline `.update()` calls.
 */
export function useUpdateShareLinkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("executive_share_links").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.executiveShareLinks.all });
    },
  });
}

export function useDeleteShareLinkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("executive_share_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.executiveShareLinks.all });
    },
  });
}
