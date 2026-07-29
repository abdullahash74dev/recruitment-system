import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface Referral {
  id: string;
  referrer_id: string | null;
  referrer_email: string | null;
  referrer_name: string | null;
  candidate_name: string;
  candidate_email: string | null;
  candidate_phone: string | null;
  position_applied: string | null;
  relationship: string | null;
  notes: string | null;
  status: "submitted" | "reviewing" | "interviewing" | "hired" | "rejected" | "withdrawn";
  reward_amount: number;
  reward_currency: string;
  reward_paid: boolean;
  reward_paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type NewReferral = Partial<Referral> & { candidate_name: string };

export function useReferralsQuery() {
  return useQuery({
    queryKey: queryKeys.referrals.list(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Referral[];
    },
  });
}

export function useCreateReferralMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: NewReferral) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("referrals").insert({
        ...payload,
        referrer_id: userData.user?.id ?? null,
        referrer_email: userData.user?.email ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.referrals.all });
      toast.success("تم تسجيل الإحالة");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateReferralMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Referral> }) => {
      const { error } = await (supabase as any)
        .from("referrals")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.referrals.all });
      toast.success("تم التحديث");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarkRewardPaidMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("referrals")
        .update({ reward_paid: true, reward_paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.referrals.all });
      toast.success("تم تسجيل صرف المكافأة");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteReferralMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("referrals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.referrals.all });
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
