import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export type TalentExchangeStatus = "draft" | "pending_consent" | "active" | "withdrawn" | "expired";
export type TalentExchangeConsentStatus = "pending" | "confirmed" | "declined";
export type ReleaseReasonCategory = "cost_reduction" | "restructuring" | "contract_end" | "relocation" | "other";

export interface TalentExchangeListing {
  id: string;
  client_organization_id: string;
  employee_full_name: string;
  employee_contact_email: string;
  employee_contact_phone: string | null;
  position_title: string;
  job_level: string | null;
  current_salary: number | null;
  current_work_location: string | null;
  release_reason_category: ReleaseReasonCategory;
  release_reason_note: string | null;
  status: TalentExchangeStatus;
  consent_status: TalentExchangeConsentStatus;
  created_at: string;
}

export interface TalentExchangeBrowseRow {
  id: string;
  position_title: string;
  job_level: string | null;
  current_salary: number | null;
  current_work_location: string | null;
  release_reason_category: ReleaseReasonCategory;
  release_reason_note: string | null;
  created_at: string;
  is_revealed_by_me: boolean;
}

export interface TalentExchangeRevealResult {
  id: string;
  employee_full_name: string;
  employee_contact_email: string;
  employee_contact_phone: string | null;
  position_title: string;
  job_level: string | null;
  current_salary: number | null;
  current_work_location: string | null;
  release_reason_category: ReleaseReasonCategory;
  release_reason_note: string | null;
  releasing_company_name: string | null;
  credits_remaining: number;
}

// ---------------------------------------------------------------------------
// A releasing company's own listings
// ---------------------------------------------------------------------------

export function useMyTalentExchangeListingsQuery() {
  return useQuery({
    queryKey: queryKeys.talentExchange.mine(),
    queryFn: async (): Promise<TalentExchangeListing[]> => {
      const { data, error } = await (supabase as any)
        .from("talent_exchange_listings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TalentExchangeListing[];
    },
  });
}

export interface CreateTalentExchangeListingInput {
  employee_full_name: string;
  employee_contact_email: string;
  employee_contact_phone?: string;
  position_title: string;
  job_level?: string;
  current_salary?: number;
  current_work_location?: string;
  release_reason_category: ReleaseReasonCategory;
  release_reason_note?: string;
}

export function useCreateTalentExchangeListingMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (input: CreateTalentExchangeListingInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error(ar ? "الجلسة منتهية" : "Session expired");
      const { data: clientUser, error: clientUserError } = await (supabase as any)
        .from("client_users")
        .select("client_organization_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (clientUserError || !clientUser) throw new Error(ar ? "تعذر تحديد الشركة" : "Could not resolve organization");

      const { data, error } = await (supabase as any)
        .from("talent_exchange_listings")
        .insert({ ...input, client_organization_id: clientUser.client_organization_id, created_by: userData.user.id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.talentExchange.mine() });
      toast.success(ar ? "تم حفظ البيانات -- الخطوة التالية إرسال رابط الموافقة للموظف" : "Saved -- next, send the consent link to the employee");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useWithdrawTalentExchangeListingMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("talent_exchange_listings").update({ status: "withdrawn" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.talentExchange.mine() });
      queryClient.invalidateQueries({ queryKey: queryKeys.talentExchange.all() });
      toast.success(ar ? "تم سحب الإعلان" : "Listing withdrawn");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSendTalentExchangeConsentMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (listingId: string) => {
      const { data, error } = await supabase.functions.invoke("send-talent-exchange-consent", {
        body: { listingId, origin: window.location.origin },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || (ar ? "فشل الإرسال" : "Failed to send"));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.talentExchange.mine() });
      toast.success(ar ? "تم إرسال رابط الموافقة للموظف عبر البريد" : "Consent link emailed to the employee");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Browsing other companies' active, confirmed listings
// ---------------------------------------------------------------------------

export function useTalentExchangeBrowseQuery() {
  return useQuery({
    queryKey: queryKeys.talentExchange.browse(),
    queryFn: async (): Promise<TalentExchangeBrowseRow[]> => {
      const { data, error } = await (supabase as any)
        .from("talent_exchange_browse")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TalentExchangeBrowseRow[];
    },
  });
}

export function useRevealTalentExchangeListingMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (listingId: string): Promise<TalentExchangeRevealResult> => {
      const { data, error } = await supabase.functions.invoke("reveal-talent-exchange-listing", { body: { listingId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as TalentExchangeRevealResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.talentExchange.browse() });
      toast.success(ar ? "تم كشف بيانات التواصل" : "Contact details revealed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Admin oversight (raw table, same RLS the admin policy already allows)
// ---------------------------------------------------------------------------

export function useAllTalentExchangeListingsQuery() {
  return useQuery({
    queryKey: queryKeys.talentExchange.all(),
    queryFn: async (): Promise<(TalentExchangeListing & { client_organizations: { name: string } | null })[]> => {
      const { data, error } = await (supabase as any)
        .from("talent_exchange_listings")
        .select("*, client_organizations(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (TalentExchangeListing & { client_organizations: { name: string } | null })[];
    },
  });
}
