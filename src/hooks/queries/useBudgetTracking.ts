import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface RecruitmentBudget {
  id: string;
  department: string;
  fiscal_year: number;
  total_budget: number;
  currency: string;
  notes: string | null;
  created_at: string;
}

export type CostType =
  | "job_board" | "agency" | "referral_bonus" | "interview"
  | "assessment" | "onboarding" | "relocation" | "other";

export interface HiringCost {
  id: string;
  applicant_id: string | null;
  department: string | null;
  cost_type: CostType;
  amount: number;
  currency: string;
  description: string | null;
  cost_date: string;
  created_by: string | null;
  created_at: string;
}

export function useBudgetsQuery() {
  return useQuery({
    queryKey: queryKeys.budgetTracking.budgets(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("recruitment_budgets")
        .select("*")
        .order("fiscal_year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RecruitmentBudget[];
    },
  });
}

export function useHiringCostsQuery() {
  return useQuery({
    queryKey: queryKeys.budgetTracking.costs(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("hiring_costs")
        .select("*")
        .order("cost_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HiringCost[];
    },
  });
}

/** Hired-applicant count, the denominator for cost-per-hire. */
export function useHiredCountQuery() {
  return useQuery({
    queryKey: [...queryKeys.budgetTracking.all, "hiredCount"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("applicants")
        .select("id", { count: "exact", head: true })
        .eq("status", "hired");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useUpsertBudgetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { department: string; fiscal_year: number; total_budget: number; currency?: string; notes?: string }) => {
      const { error } = await (supabase as any)
        .from("recruitment_budgets")
        .upsert(payload, { onConflict: "department,fiscal_year" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetTracking.all });
      toast.success("تم حفظ الميزانية");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddCostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<HiringCost> & { cost_type: CostType; amount: number }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("hiring_costs")
        .insert({ ...payload, created_by: userData.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetTracking.all });
      toast.success("تم تسجيل التكلفة");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("hiring_costs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetTracking.all });
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
