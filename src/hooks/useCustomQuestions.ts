import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";

export interface CustomQuestion {
  id: string;
  question_ar: string;
  question_en: string | null;
  type: string;
  options_ar: string[];
  options_en: string[];
  is_required: boolean;
  step_number: number;
  sort_order: number;
  is_active: boolean;
}

async function fetchCustomQuestionsRaw(): Promise<CustomQuestion[]> {
  const { data } = await supabase
    .from("custom_questions")
    .select("*")
    .order("step_number", { ascending: true })
    .order("sort_order", { ascending: true });
  return (data as CustomQuestion[]) || [];
}

export const invalidateCustomQuestionsCache = () =>
  queryClient.invalidateQueries({ queryKey: queryKeys.customQuestions.all });

export const useCustomQuestions = () => {
  // Bound directly to the singleton queryClient so this shares the cache
  // with both CustomQuestionsSettings (admin editor) and CustomQuestionsStep
  // (public ApplicationForm) even outside a QueryClientProvider (e.g. tests).
  const query = useQuery({ queryKey: queryKeys.customQuestions.all, queryFn: fetchCustomQuestionsRaw }, queryClient);
  return { questions: query.data ?? [], loaded: query.isSuccess };
};
