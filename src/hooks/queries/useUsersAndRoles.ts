import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

async function fetchProfiles(): Promise<any[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function fetchUserRoles(): Promise<any[]> {
  const { data, error } = await supabase.from("user_roles").select("*");
  if (error) throw error;
  return data ?? [];
}

export function useProfilesQuery() {
  return useQuery({
    queryKey: queryKeys.profiles.list(),
    queryFn: fetchProfiles,
  });
}

export function useUserRolesQuery() {
  return useQuery({
    queryKey: queryKeys.userRoles.list(),
    queryFn: fetchUserRoles,
  });
}

/**
 * User management (create/update role/toggle active/delete/reset password)
 * goes through the `manage-user` edge function rather than direct table
 * writes, so there's no matching `useMutation` here — callers should
 * `invalidateUsersAndRoles(queryClient)` after a successful edge function
 * call instead of re-fetching manually.
 */
export function invalidateUsersAndRoles(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.userRoles.all });
}
