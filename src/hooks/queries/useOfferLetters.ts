import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OfferLetterStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type ContractType = "permanent" | "contract" | "part_time";

export interface OfferLetter {
  id: string;
  applicant_id: string;
  position_title: string;
  department: string | null;
  salary_offered: number | null;
  salary_currency: string;
  start_date: string | null;
  contract_type: ContractType;
  benefits: string | null;
  additional_terms: string | null;
  status: OfferLetterStatus;
  sent_at: string | null;
  responded_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface OfferLetterWithApplicant extends OfferLetter {
  applicants: { full_name: string; email: string | null; phone: string | null } | null;
}

export interface CreateOfferLetterInput {
  applicant_id: string;
  position_title: string;
  department?: string | null;
  salary_offered?: number | null;
  salary_currency?: string;
  start_date?: string | null;
  contract_type?: ContractType;
  benefits?: string | null;
  additional_terms?: string | null;
  expires_at?: string | null;
}

export interface UpdateOfferLetterInput {
  id: string;
  patch: Partial<
    Omit<CreateOfferLetterInput, "applicant_id"> & { status?: OfferLetterStatus }
  >;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useOfferLettersQuery() {
  return useQuery({
    queryKey: queryKeys.offerLetters.list(),
    queryFn: async (): Promise<OfferLetterWithApplicant[]> => {
      const { data, error } = await supabase
        .from("offer_letters")
        .select("*, applicants(full_name, email, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OfferLetterWithApplicant[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateOfferLetterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOfferLetterInput) => {
      const { error } = await supabase
        .from("offer_letters")
        .insert(input as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.offerLetters.all });
      toast.success("تم إنشاء عرض التوظيف بنجاح");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateOfferLetterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateOfferLetterInput) => {
      const { error } = await supabase
        .from("offer_letters")
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.offerLetters.all });
      toast.success("تم تحديث عرض التوظيف بنجاح");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useSendOfferLetterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("offer_letters")
        .update({ status: "sent", sent_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.offerLetters.all });
      toast.success("تم إرسال عرض التوظيف");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
