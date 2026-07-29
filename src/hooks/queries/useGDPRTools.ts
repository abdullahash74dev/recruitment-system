import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface RetentionPolicy {
  id: string;
  entity_type: string;
  retention_days: number;
  action_after: "anonymize" | "delete" | "archive";
  is_active: boolean;
  updated_at: string;
}

export interface PrivacyRequest {
  id: string;
  request_type: "access" | "deletion" | "correction" | "portability";
  requester_email: string;
  requester_name: string | null;
  status: "pending" | "processing" | "completed" | "rejected";
  notes: string | null;
  completed_at: string | null;
  created_at: string;
}

export function useRetentionPoliciesQuery() {
  return useQuery({
    queryKey: queryKeys.gdprTools.policies(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("data_retention_policies")
        .select("*")
        .order("entity_type");
      if (error) throw error;
      return (data ?? []) as RetentionPolicy[];
    },
  });
}

export function useUpdateRetentionPolicyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<RetentionPolicy> }) => {
      const { error } = await (supabase as any)
        .from("data_retention_policies")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gdprTools.all });
      toast.success("تم تحديث السياسة");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePrivacyRequestsQuery() {
  return useQuery({
    queryKey: queryKeys.gdprTools.requests(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("privacy_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PrivacyRequest[];
    },
  });
}

export function useCreatePrivacyRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      request_type: PrivacyRequest["request_type"];
      requester_email: string;
      requester_name?: string;
      notes?: string;
    }) => {
      const { error } = await (supabase as any).from("privacy_requests").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gdprTools.all });
      toast.success("تم تسجيل الطلب");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePrivacyRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: PrivacyRequest["status"]; notes?: string }) => {
      const { error } = await (supabase as any)
        .from("privacy_requests")
        .update({
          status,
          notes: notes ?? undefined,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gdprTools.all });
      toast.success("تم التحديث");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Counts rows past their retention window for each active policy. Read-only —
 * nothing is deleted; the result is a compliance report the admin acts on.
 */
export function useRetentionAnalysisQuery(enabled: boolean) {
  const policiesQuery = useRetentionPoliciesQuery();
  return useQuery({
    queryKey: [...queryKeys.gdprTools.all, "analysis", policiesQuery.data?.length ?? 0],
    enabled: enabled && !policiesQuery.isLoading,
    queryFn: async () => {
      const policies = (policiesQuery.data ?? []).filter((p) => p.is_active);
      const results: { entity_type: string; overdue: number; retention_days: number; action_after: string }[] = [];
      for (const p of policies) {
        const cutoff = new Date(Date.now() - p.retention_days * 86400000).toISOString();
        // audit_log stamps its rows with occurred_at rather than created_at.
        const dateCol = p.entity_type === "audit_log" ? "occurred_at" : "created_at";
        const { count, error } = await (supabase as any)
          .from(p.entity_type)
          .select("id", { count: "exact", head: true })
          .lt(dateCol, cutoff);
        results.push({
          entity_type: p.entity_type,
          overdue: error ? -1 : count ?? 0,
          retention_days: p.retention_days,
          action_after: p.action_after,
        });
      }
      return results;
    },
  });
}
