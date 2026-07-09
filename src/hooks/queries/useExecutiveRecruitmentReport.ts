import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Mirrors the original ExecutiveRecruitmentPage mount effect's
 * `get_executive_recruitment` RPC call (a public, token-scoped report).
 */
export function useExecutiveRecruitmentReportQuery(token?: string) {
  return useQuery({
    queryKey: queryKeys.executiveReport.detail(token),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_executive_recruitment", { p_token: token });
      if (error) throw error;
      return data;
    },
    enabled: !!token,
    retry: false,
  });
}
