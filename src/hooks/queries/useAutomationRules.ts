import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export type TriggerEvent = "applicant_created" | "status_changed" | "days_in_stage" | "daily_check";
export type ActionType = "change_status" | "send_notification" | "assign_tag" | "log_note";

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_event: TriggerEvent;
  trigger_condition_field: string | null;
  trigger_condition_value: string | null;
  action_type: ActionType;
  action_value: string | null;
  run_count: number;
  last_run_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AutomationLog {
  id: string;
  rule_id: string | null;
  success: boolean;
  details: string | null;
  ran_at: string;
}

export function useAutomationRulesQuery() {
  return useQuery({
    queryKey: queryKeys.automationRules.list(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("automation_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AutomationRule[];
    },
  });
}

export function useAutomationLogsQuery() {
  return useQuery({
    queryKey: queryKeys.automationRules.logs(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("automation_logs")
        .select("*")
        .order("ran_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AutomationLog[];
    },
  });
}

export function useCreateAutomationRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AutomationRule> & { name: string; trigger_event: TriggerEvent; action_type: ActionType }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("automation_rules")
        .insert({ ...payload, created_by: userData.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automationRules.all });
      toast.success("تم إنشاء القاعدة");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAutomationRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<AutomationRule> }) => {
      const { error } = await (supabase as any).from("automation_rules").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automationRules.all });
      toast.success("تم التحديث");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAutomationRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("automation_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automationRules.all });
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Evaluates one rule against the applicants table and applies its action.
 * Only `days_in_stage` -> `change_status` mutates data; the other combinations
 * record what *would* have matched, so a rule can be dry-run before trusting it.
 */
export function useRunRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rule: AutomationRule) => {
      let details = "";
      let success = true;
      try {
        if (rule.trigger_event === "days_in_stage") {
          const days = Number(rule.trigger_condition_value) || 7;
          const stage = rule.trigger_condition_field || "reviewing";
          const cutoff = new Date(Date.now() - days * 86400000).toISOString();
          const { data, error } = await supabase
            .from("applicants")
            .select("id")
            .eq("status", stage)
            .lt("created_at", cutoff);
          if (error) throw error;
          const ids = (data ?? []).map((r: { id: string }) => r.id);

          if (rule.action_type === "change_status" && rule.action_value && ids.length > 0) {
            const { error: updateError } = await supabase
              .from("applicants")
              .update({ status: rule.action_value as never })
              .in("id", ids);
            if (updateError) throw updateError;
            details = `تم تغيير حالة ${ids.length} متقدم إلى ${rule.action_value}`;
          } else {
            details = `تطابق ${ids.length} متقدم (لم يُطبَّق إجراء)`;
          }
        } else {
          details = "هذا المُشغِّل يعمل تلقائياً عند وقوع الحدث — لا يوجد تنفيذ يدوي";
        }
      } catch (e) {
        success = false;
        details = e instanceof Error ? e.message : String(e);
      }

      await (supabase as any).from("automation_logs").insert({ rule_id: rule.id, success, details });
      await (supabase as any)
        .from("automation_rules")
        .update({ run_count: rule.run_count + 1, last_run_at: new Date().toISOString() })
        .eq("id", rule.id);

      if (!success) throw new Error(details);
      return details;
    },
    onSuccess: (details) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automationRules.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.applicants.all });
      toast.success(details);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
