import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ClientFilterValue, ClientSearchMode } from "@/hooks/queries/useClientPortalSearch";

// client_saved_filters is a new table not yet present in the generated
// Supabase types, so every call below casts `supabase as any` -- same
// pattern as useClientPackages.ts. RLS (not an edge function) scopes every
// row to the caller's own client_organization_id, since a saved filter is
// just field/value criteria, not applicant PII -- no masking/credit concern.
export interface ClientSavedFilter {
  id: string;
  name: string;
  filters: ClientFilterValue[];
  search: string;
  search_mode: ClientSearchMode;
  result_count: number | null;
  created_at: string;
}

const CLIENT_SAVED_FILTERS_QUERY_KEY = ["clientPortal", "savedFilters"] as const;

export function useClientSavedFiltersQuery() {
  return useQuery({
    queryKey: CLIENT_SAVED_FILTERS_QUERY_KEY,
    queryFn: async (): Promise<ClientSavedFilter[]> => {
      const { data, error } = await (supabase as any)
        .from("client_saved_filters")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ClientSavedFilter[];
    },
  });
}

export interface SaveClientFilterInput {
  name: string;
  filters: ClientFilterValue[];
  search: string;
  search_mode: ClientSearchMode;
  result_count: number;
}

export function useSaveClientFilterMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (input: SaveClientFilterInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(ar ? "الجلسة منتهية" : "Session expired");

      // The INSERT RLS policy requires client_organization_id to already
      // equal get_my_client_organization_id() -- look it up via the same
      // client_users row ClientPortalGuard already trusts, rather than
      // relying on the caller to pass it in.
      const { data: clientUser, error: clientUserError } = await (supabase as any)
        .from("client_users")
        .select("client_organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (clientUserError || !clientUser) throw new Error(ar ? "تعذر تحديد الشركة" : "Could not resolve organization");

      const { error } = await (supabase as any).from("client_saved_filters").insert({
        name: input.name,
        filters: input.filters,
        search: input.search,
        search_mode: input.search_mode,
        result_count: input.result_count,
        created_by: user.id,
        client_organization_id: clientUser.client_organization_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_SAVED_FILTERS_QUERY_KEY });
      toast.success(ar ? "تم حفظ الفلتر" : "Filter saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || (ar ? "تعذر حفظ الفلتر" : "Failed to save filter"));
    },
  });
}

export function useDeleteClientSavedFilterMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("client_saved_filters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_SAVED_FILTERS_QUERY_KEY });
      toast.success(ar ? "تم حذف الفلتر" : "Filter deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || (ar ? "تعذر حذف الفلتر" : "Failed to delete filter"));
    },
  });
}
