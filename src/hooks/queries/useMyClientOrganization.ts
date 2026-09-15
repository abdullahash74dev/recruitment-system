import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the current client-portal user's own client_organization_id.
 * Cached (react-query, session-lifetime default staleTime is fine -- this
 * never changes for a signed-in client user), so components that need to
 * pass the org id into a shared component (e.g. PhoneScreeningDialog) don't
 * each re-query client_users themselves.
 */
export function useMyClientOrganizationId() {
  return useQuery({
    queryKey: ["clientPortal", "myOrganizationId"],
    queryFn: async (): Promise<string | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from("client_users")
        .select("client_organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.client_organization_id ?? null;
    },
    staleTime: 10 * 60 * 1000,
  });
}
