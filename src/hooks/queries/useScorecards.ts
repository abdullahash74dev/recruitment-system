import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export type ScorecardRecommendation =
  | "strong_hire"
  | "hire"
  | "maybe"
  | "no_hire"
  | "strong_no";

export interface Scorecard {
  id: string;
  applicant_id: string;
  evaluator_id: string | null;
  evaluator_email: string | null;
  overall_rating: number | null;
  communication_rating: number | null;
  technical_rating: number | null;
  culture_fit_rating: number | null;
  strengths: string | null;
  weaknesses: string | null;
  recommendation: ScorecardRecommendation | null;
  notes: string | null;
  created_at: string;
  // Joined from applicants
  applicant_name?: string | null;
}

export interface ScorecardWithApplicant extends Scorecard {
  applicants: { full_name: string } | null;
}

export interface CreateScorecardInput {
  applicant_id: string;
  evaluator_id?: string | null;
  evaluator_email?: string | null;
  overall_rating?: number | null;
  communication_rating?: number | null;
  technical_rating?: number | null;
  culture_fit_rating?: number | null;
  strengths?: string | null;
  weaknesses?: string | null;
  recommendation?: ScorecardRecommendation | null;
  notes?: string | null;
}

export interface UpdateScorecardInput {
  id: string;
  patch: Partial<Omit<CreateScorecardInput, "applicant_id">>;
}

export function useScorecardsQuery() {
  return useQuery({
    queryKey: queryKeys.scorecards.list(),
    queryFn: async (): Promise<ScorecardWithApplicant[]> => {
      const { data, error } = await supabase
        .from("interview_scorecards")
        .select("*, applicants(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ScorecardWithApplicant[];
    },
  });
}

export function useCreateScorecardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateScorecardInput) => {
      const { error } = await supabase
        .from("interview_scorecards")
        .insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scorecards.all });
      toast.success("تم إنشاء التقييم بنجاح");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateScorecardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateScorecardInput) => {
      const { error } = await supabase
        .from("interview_scorecards")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scorecards.all });
      toast.success("تم تحديث التقييم بنجاح");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteScorecardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("interview_scorecards")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scorecards.all });
      toast.success("تم حذف التقييم بنجاح");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
