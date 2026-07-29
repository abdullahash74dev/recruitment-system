import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

export interface TalentPoolEntry {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  current_company: string | null;
  current_title: string | null;
  years_experience: string | null;
  skills: string | null;
  desired_salary_min: number | null;
  desired_salary_max: number | null;
  preferred_locations: string | null;
  availability: "immediate" | "1_month" | "3_months" | "6_months" | "not_looking";
  notes: string | null;
  source: string | null;
  tags: string | null;
  last_contacted_at: string | null;
  next_followup_at: string | null;
  rating: number | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

export type TalentPoolInsert = Omit<TalentPoolEntry, "id" | "created_at" | "updated_at">;
export type TalentPoolUpdate = Partial<TalentPoolInsert>;

/** Returns all talent pool entries ordered by creation date descending. */
export function useTalentPoolQuery() {
  return useQuery({
    queryKey: queryKeys.talentPool.list(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("talent_pool")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TalentPoolEntry[];
    },
  });
}

/** Inserts a new passive candidate into the talent pool. */
export function useCreateTalentPoolMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TalentPoolInsert) => {
      const { error } = await (supabase as any).from("talent_pool").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.talentPool.all });
      toast.success("تم إضافة المرشح بنجاح");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

/** Updates an existing talent pool entry by id. */
export function useUpdateTalentPoolMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TalentPoolUpdate }) => {
      const { error } = await (supabase as any)
        .from("talent_pool")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.talentPool.all });
      toast.success("تم تحديث بيانات المرشح");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

/** Deletes a talent pool entry by id. */
export function useDeleteTalentPoolMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("talent_pool")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.talentPool.all });
      toast.success("تم حذف المرشح");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
