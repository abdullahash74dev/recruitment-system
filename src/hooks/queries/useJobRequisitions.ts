import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface JobRequisition {
  id: string;
  title: string;
  department: string | null;
  headcount: number;
  justification: string | null;
  required_skills: string | null;
  salary_range_min: number | null;
  salary_range_max: number | null;
  employment_type: "full_time" | "part_time" | "contract" | "intern";
  priority: "low" | "medium" | "high" | "urgent";
  target_start_date: string | null;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "on_hold" | "fulfilled";
  requested_by: string | null;
  requested_by_email: string | null;
  approved_by: string | null;
  approved_by_email: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type NewJobRequisition = Partial<JobRequisition> & { title: string };

export function useJobRequisitionsQuery() {
  return useQuery({
    queryKey: queryKeys.jobRequisitions.list(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("job_requisitions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as JobRequisition[];
    },
  });
}

export function useCreateRequisitionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: NewJobRequisition) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("job_requisitions").insert({
        ...payload,
        requested_by: userData.user?.id ?? null,
        requested_by_email: userData.user?.email ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobRequisitions.all });
      toast.success("تم إنشاء الطلب");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateRequisitionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<JobRequisition> }) => {
      const { error } = await (supabase as any)
        .from("job_requisitions")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobRequisitions.all });
      toast.success("تم التحديث");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveRequisitionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("job_requisitions")
        .update({
          status: "approved",
          approved_by: userData.user?.id ?? null,
          approved_by_email: userData.user?.email ?? null,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobRequisitions.all });
      toast.success("تمت الموافقة على الطلب");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRejectRequisitionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("job_requisitions")
        .update({
          status: "rejected",
          rejection_reason: reason,
          approved_by: userData.user?.id ?? null,
          approved_by_email: userData.user?.email ?? null,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobRequisitions.all });
      toast.success("تم رفض الطلب");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRequisitionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("job_requisitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobRequisitions.all });
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
