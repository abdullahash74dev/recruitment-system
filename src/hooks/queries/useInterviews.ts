import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InterviewType = "phone" | "video" | "in_person";
export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export interface InterviewApplicant {
  id: string;
  full_name: string;
  desired_position: string | null;
}

export interface InterviewInterviewer {
  id: string;
  display_name: string | null;
  email: string | null;
}

export interface Interview {
  id: string;
  applicant_id: string | null;
  interviewer_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  meeting_link: string | null;
  type: InterviewType;
  status: InterviewStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  applicant: InterviewApplicant | null;
  interviewer: InterviewInterviewer | null;
}

export interface CreateInterviewParams {
  applicant_id: string | null;
  interviewer_id: string | null;
  scheduled_at: string;
  duration_minutes?: number;
  location?: string | null;
  meeting_link?: string | null;
  type: InterviewType;
  status?: InterviewStatus;
  notes?: string | null;
  created_by?: string | null;
}

export interface UpdateInterviewParams {
  id: string;
  patch: Partial<Omit<CreateInterviewParams, "created_by">>;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useInterviewsQuery() {
  return useQuery({
    queryKey: queryKeys.interviews.list(),
    queryFn: async (): Promise<Interview[]> => {
      const { data, error } = await supabase
        .from("interviews")
        .select(
          `*,
          applicant:applicants!applicant_id(id, full_name, desired_position),
          interviewer:profiles!interviewer_id(id, display_name, email)`
        )
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Interview[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateInterviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: CreateInterviewParams) => {
      const { error } = await supabase.from("interviews").insert(params as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all });
      toast.success("تمت جدولة المقابلة بنجاح");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateInterviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateInterviewParams) => {
      const { error } = await supabase
        .from("interviews")
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all });
      toast.success("تم تحديث المقابلة بنجاح");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteInterviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("interviews")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interviews.all });
      toast.success("تم حذف المقابلة");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
