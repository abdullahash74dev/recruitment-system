import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export type QuestionType = "multiple_choice" | "true_false" | "short_answer";
export type AssignmentStatus = "assigned" | "in_progress" | "completed" | "expired";

export interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  question_text: string;
  question_type: QuestionType;
  /** Newline/comma separated choices — only meaningful for multiple_choice. */
  options: string | null;
  correct_answer: string | null;
  points: number;
  order_index: number;
}

export interface Assessment {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  duration_minutes: number | null;
  passing_score: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  questions?: AssessmentQuestion[];
}

export interface AssessmentAssignment {
  id: string;
  assessment_id: string;
  applicant_id: string | null;
  applicant_name: string | null;
  status: AssignmentStatus;
  score: number | null;
  max_score: number | null;
  passed: boolean | null;
  started_at: string | null;
  completed_at: string | null;
  due_date: string | null;
  assigned_by: string | null;
  created_at: string;
  /** Joined parent assessment (title/passing score) for display. */
  assessment?: Pick<Assessment, "id" | "title" | "category" | "passing_score"> | null;
}

export interface NewQuestion {
  question_text: string;
  question_type: QuestionType;
  options?: string | null;
  correct_answer?: string | null;
  points: number;
}

export interface NewAssessment {
  title: string;
  description?: string | null;
  category?: string | null;
  duration_minutes: number;
  passing_score: number;
  questions: NewQuestion[];
}

/** Assessment bank with every assessment's questions nested and ordered. */
export function useAssessmentsQuery() {
  return useQuery({
    queryKey: queryKeys.assessments.list(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("assessments")
        .select("*, assessment_questions(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((a) => ({
        ...a,
        questions: [...((a.assessment_questions ?? []) as AssessmentQuestion[])].sort(
          (x, y) => x.order_index - y.order_index
        ),
      })) as Assessment[];
    },
  });
}

/** Inserts the assessment, then bulk-inserts its questions with their order. */
export function useCreateAssessmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: NewAssessment) => {
      const { questions, ...assessment } = payload;
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("assessments")
        .insert({
          title: assessment.title,
          description: assessment.description ?? null,
          category: assessment.category ?? null,
          duration_minutes: assessment.duration_minutes,
          passing_score: assessment.passing_score,
          is_active: true,
          created_by: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (questions.length > 0) {
        const { error: questionError } = await (supabase as any).from("assessment_questions").insert(
          questions.map((q, i) => ({
            assessment_id: data.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.question_type === "multiple_choice" ? q.options ?? null : null,
            correct_answer: q.correct_answer ?? null,
            points: q.points,
            order_index: i,
          }))
        );
        if (questionError) throw questionError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
      toast.success("تم إنشاء الاختبار");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAssessmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("assessments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
      toast.success("تم حذف الاختبار");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAssessmentAssignmentsQuery() {
  return useQuery({
    queryKey: queryKeys.assessments.assignments(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("assessment_assignments")
        .select("*, assessments(id, title, category, passing_score)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((a) => ({
        ...a,
        assessment: a.assessments ?? null,
      })) as AssessmentAssignment[];
    },
  });
}

export function useAssignAssessmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      assessment_id: string;
      applicant_name: string;
      applicant_id?: string | null;
      due_date?: string | null;
      max_score?: number | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("assessment_assignments").insert({
        assessment_id: payload.assessment_id,
        applicant_id: payload.applicant_id ?? null,
        applicant_name: payload.applicant_name,
        due_date: payload.due_date || null,
        max_score: payload.max_score ?? null,
        status: "assigned",
        assigned_by: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
      toast.success("تم تكليف المرشح بالاختبار");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Patches an assignment; status changes stamp the matching timestamp. */
export function useUpdateAssignmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AssessmentAssignment> & { id: string }) => {
      const patch: Record<string, unknown> = { ...updates };
      if (updates.status === "in_progress") patch.started_at = updates.started_at ?? new Date().toISOString();
      if (updates.status === "completed") patch.completed_at = updates.completed_at ?? new Date().toISOString();
      const { error } = await (supabase as any).from("assessment_assignments").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
      toast.success("تم التحديث");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Manual grading: stores the score and derives pass/fail from the
 *  assessment's passing score, marking the assignment completed. */
export function useGradeAssignmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      score,
      max_score,
      passing_score,
    }: {
      id: string;
      score: number;
      max_score: number;
      passing_score: number;
    }) => {
      const { error } = await (supabase as any)
        .from("assessment_assignments")
        .update({
          score,
          max_score,
          passed: score >= passing_score,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments.all });
      toast.success("تم رصد الدرجة");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
