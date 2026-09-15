import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

// Shared by both the internal HR dashboard and the client portal --
// `clientOrganizationId` undefined/omitted means "the internal/admin
// scope" (client_organization_id IS NULL in the DB); passing an org id
// scopes every read/write to that client's own independent settings,
// question bank, and screening history. RLS enforces the same boundary
// server-side regardless of what a caller passes here.

export interface PhoneScreeningSettings {
  id: string;
  client_organization_id: string | null;
  min_duration_seconds: number;
  initial_max_duration_seconds: number;
  extended_max_duration_seconds: number;
}

const DEFAULT_SETTINGS: Omit<PhoneScreeningSettings, "id" | "client_organization_id"> = {
  min_duration_seconds: 60,
  initial_max_duration_seconds: 180,
  extended_max_duration_seconds: 600,
};

export interface PhoneScreeningQuestion {
  id: string;
  client_organization_id: string | null;
  question_ar: string;
  question_en: string | null;
  expected_answer_ar: string | null;
  expected_answer_en: string | null;
  display_order: number;
  is_active: boolean;
}

export type ScreeningDecision = "passed" | "rejected" | "pending";
export type AnswerResult = "passed" | "failed" | "skipped";

export interface PhoneScreening {
  id: string;
  applicant_id: string;
  client_organization_id: string | null;
  performed_by: string;
  performed_by_name: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  was_extended: boolean;
  decision: ScreeningDecision;
  rejection_reason_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface PhoneScreeningAnswer {
  id: string;
  screening_id: string;
  question_id: string | null;
  question_snapshot: string;
  result: AnswerResult;
}

export interface PhoneScreeningWithAnswers extends PhoneScreening {
  phone_screening_answers: PhoneScreeningAnswer[];
}

function scopeFilter<T extends { is: Function; eq: Function }>(query: T, clientOrganizationId: string | undefined) {
  return clientOrganizationId ? query.eq("client_organization_id", clientOrganizationId) : query.is("client_organization_id", null);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function usePhoneScreeningSettingsQuery(clientOrganizationId?: string) {
  return useQuery({
    queryKey: queryKeys.phoneScreening.settings(clientOrganizationId),
    queryFn: async (): Promise<PhoneScreeningSettings> => {
      let query = (supabase as any).from("phone_screening_settings").select("*");
      query = scopeFilter(query, clientOrganizationId);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (data) return data as PhoneScreeningSettings;
      // A client org that hasn't saved settings yet has no row -- fall back
      // to the same defaults the internal seed row uses.
      return { id: "", client_organization_id: clientOrganizationId ?? null, ...DEFAULT_SETTINGS };
    },
  });
}

export function useSavePhoneScreeningSettingsMutation(clientOrganizationId: string | undefined, lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (patch: Partial<Omit<PhoneScreeningSettings, "id" | "client_organization_id">>) => {
      let existingQuery = (supabase as any).from("phone_screening_settings").select("id");
      existingQuery = scopeFilter(existingQuery, clientOrganizationId);
      const { data: existing, error: findError } = await existingQuery.maybeSingle();
      if (findError) throw findError;

      if (existing) {
        const { error } = await (supabase as any).from("phone_screening_settings").update(patch).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("phone_screening_settings")
          .insert({ ...DEFAULT_SETTINGS, ...patch, client_organization_id: clientOrganizationId ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.phoneScreening.settings(clientOrganizationId) });
      toast.success(ar ? "تم حفظ الإعدادات" : "Settings saved");
    },
    onError: (e: Error) => toast.error(e.message || (ar ? "تعذر الحفظ" : "Failed to save")),
  });
}

// ---------------------------------------------------------------------------
// Question bank
// ---------------------------------------------------------------------------

export function usePhoneScreeningQuestionsQuery(clientOrganizationId?: string, activeOnly = true) {
  return useQuery({
    queryKey: queryKeys.phoneScreening.questions(clientOrganizationId),
    queryFn: async (): Promise<PhoneScreeningQuestion[]> => {
      let query = (supabase as any).from("phone_screening_questions").select("*");
      query = scopeFilter(query, clientOrganizationId);
      if (activeOnly) query = query.eq("is_active", true);
      query = query.order("display_order", { ascending: true });
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PhoneScreeningQuestion[];
    },
  });
}

export function useCreatePhoneScreeningQuestionMutation(clientOrganizationId: string | undefined, lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (input: {
      question_ar: string;
      question_en?: string | null;
      expected_answer_ar?: string | null;
      expected_answer_en?: string | null;
      display_order?: number;
    }) => {
      const question_ar = input.question_ar.trim();
      if (!question_ar) throw new Error(ar ? "نص السؤال مطلوب" : "Question text is required");
      const { error } = await (supabase as any).from("phone_screening_questions").insert({
        client_organization_id: clientOrganizationId ?? null,
        question_ar,
        question_en: input.question_en?.trim() || null,
        expected_answer_ar: input.expected_answer_ar?.trim() || null,
        expected_answer_en: input.expected_answer_en?.trim() || null,
        display_order: input.display_order ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.phoneScreening.questions(clientOrganizationId) });
      toast.success(ar ? "تمت إضافة السؤال" : "Question added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePhoneScreeningQuestionMutation(clientOrganizationId: string | undefined, lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PhoneScreeningQuestion> }) => {
      const body: Record<string, unknown> = { ...patch };
      delete body.id;
      delete body.client_organization_id;
      const { error } = await (supabase as any).from("phone_screening_questions").update(body).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.phoneScreening.questions(clientOrganizationId) });
      toast.success(ar ? "تم التحديث" : "Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePhoneScreeningQuestionMutation(clientOrganizationId: string | undefined, lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("phone_screening_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.phoneScreening.questions(clientOrganizationId) });
      toast.success(ar ? "تم الحذف" : "Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** One-click starter kit for a client org with no questions of its own yet -- copies the internal default set into their scope. */
export function useSeedDefaultQuestionsMutation(clientOrganizationId: string, lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async () => {
      const { data: defaults, error: fetchError } = await (supabase as any)
        .from("phone_screening_questions")
        .select("question_ar, question_en, expected_answer_ar, expected_answer_en, display_order")
        .is("client_organization_id", null)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (fetchError) throw fetchError;
      if (!defaults || defaults.length === 0) return;
      const rows = defaults.map((d: any) => ({ ...d, client_organization_id: clientOrganizationId }));
      const { error } = await (supabase as any).from("phone_screening_questions").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.phoneScreening.questions(clientOrganizationId) });
      toast.success(ar ? "تم استيراد الأسئلة الافتراضية" : "Default questions imported");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Screenings
// ---------------------------------------------------------------------------

export function usePhoneScreeningsForApplicantQuery(applicantId: string | undefined, clientOrganizationId?: string) {
  return useQuery({
    queryKey: queryKeys.phoneScreening.forApplicant(applicantId ?? "", clientOrganizationId),
    enabled: !!applicantId,
    queryFn: async (): Promise<PhoneScreeningWithAnswers[]> => {
      let query = (supabase as any)
        .from("phone_screenings")
        .select("*, phone_screening_answers(*)")
        .eq("applicant_id", applicantId);
      query = scopeFilter(query, clientOrganizationId);
      query = query.order("created_at", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PhoneScreeningWithAnswers[];
    },
  });
}

export interface CreatePhoneScreeningInput {
  applicantId: string;
  clientOrganizationId?: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  wasExtended: boolean;
  decision: ScreeningDecision;
  rejectionReasonId?: string | null;
  notes?: string | null;
  answers: { questionId: string | null; questionSnapshot: string; result: AnswerResult }[];
}

export function useCreatePhoneScreeningMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (input: CreatePhoneScreeningInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("display_name, email")
        .eq("user_id", userData?.user?.id ?? "")
        .maybeSingle();
      const performedByName = profile?.display_name || profile?.email || userData?.user?.email || null;

      const { data: screening, error: screeningError } = await (supabase as any)
        .from("phone_screenings")
        .insert({
          applicant_id: input.applicantId,
          client_organization_id: input.clientOrganizationId ?? null,
          performed_by: userData?.user?.id ?? null,
          performed_by_name: performedByName,
          started_at: input.startedAt,
          ended_at: input.endedAt,
          duration_seconds: input.durationSeconds,
          was_extended: input.wasExtended,
          decision: input.decision,
          rejection_reason_id: input.rejectionReasonId ?? null,
          notes: input.notes?.trim() || null,
        })
        .select("id")
        .single();
      if (screeningError) throw screeningError;

      if (input.answers.length > 0) {
        const { error: answersError } = await (supabase as any).from("phone_screening_answers").insert(
          input.answers.map((a) => ({
            screening_id: screening.id,
            question_id: a.questionId,
            question_snapshot: a.questionSnapshot,
            result: a.result,
          }))
        );
        if (answersError) throw answersError;
      }

      return screening.id as string;
    },
    onSuccess: (_id, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.phoneScreening.forApplicant(input.applicantId, input.clientOrganizationId) });
      toast.success(ar ? "تم حفظ نتيجة التقييم" : "Screening result saved");
    },
    onError: (e: Error) => toast.error(e.message || (ar ? "تعذر حفظ التقييم" : "Failed to save the screening")),
  });
}
