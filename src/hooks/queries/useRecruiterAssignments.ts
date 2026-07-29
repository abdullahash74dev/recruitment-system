import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface RecruiterAssignment {
  id: string;
  applicant_id: string;
  recruiter_id: string | null;
  recruiter_email: string | null;
  assigned_by: string | null;
  assigned_at: string;
  notes: string | null;
  applicant_name?: string | null;
  applicant_status?: string | null;
}

export function useRecruiterAssignmentsQuery() {
  return useQuery({
    queryKey: queryKeys.recruiterAssignments.list(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("recruiter_assignments")
        .select("*, applicants(full_name, status)")
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        applicant_name: r.applicants?.full_name ?? null,
        applicant_status: r.applicants?.status ?? null,
      })) as RecruiterAssignment[];
    },
  });
}

export function useAssignRecruiterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      applicant_id,
      recruiter_id,
      recruiter_email,
      notes,
    }: {
      applicant_id: string;
      recruiter_id: string;
      recruiter_email?: string | null;
      notes?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("recruiter_assignments").upsert(
        {
          applicant_id,
          recruiter_id,
          recruiter_email: recruiter_email ?? null,
          notes: notes ?? null,
          assigned_by: userData.user?.id ?? null,
          assigned_at: new Date().toISOString(),
        },
        { onConflict: "applicant_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recruiterAssignments.all });
      toast.success("تم التعيين");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnassignRecruiterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("recruiter_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recruiterAssignments.all });
      toast.success("تم إلغاء التعيين");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
