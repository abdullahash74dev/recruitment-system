import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// NOTE: subscription_packages / client_organizations / candidate_reveals are
// new tables not yet present in the generated Supabase types, so every call
// below casts `supabase as any` (same pattern as useReferrals.ts). They also
// don't have entries in src/lib/queryKeys.ts yet — temporary local key
// factories are defined here, mirroring the restoreApprovals/backupSecrets
// pattern in useBackupRuns.ts, until a real queryKeys.ts entry is added.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubscriptionPackage {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  duration_months: number;
  price: number;
  currency: string;
  credits_included: number;
  max_users: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export type NewSubscriptionPackage = Omit<SubscriptionPackage, "id" | "created_at" | "updated_at">;

export type ClientSubscriptionStatus = "active" | "expired" | "suspended";

export interface ClientOrganization {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  package_id: string | null;
  credits_remaining: number;
  starts_at: string | null;
  expires_at: string | null;
  subscription_status: ClientSubscriptionStatus | string;
  notes: string | null;
  created_at: string;
  updated_at?: string;
  // Nested join added by .select("*, subscription_packages(name_ar, name_en, credits_included)")
  subscription_packages?: {
    name_ar: string;
    name_en: string;
    credits_included: number;
  } | null;
}

export interface NewClientOrgInput {
  name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  package_id: string;
  notes?: string | null;
}

export interface CandidateReveal {
  id: string;
  client_organization_id: string;
  applicant_id: string;
  revealed_by: string | null;
  revealed_at: string;
}

// ---------------------------------------------------------------------------
// Temporary local query keys (see NOTE above)
// ---------------------------------------------------------------------------

const clientPackagesKeys = {
  all: ["clientPackages"] as const,
  list: () => ["clientPackages", "list"] as const,
};

const clientOrgsKeys = {
  all: ["clientOrganizations"] as const,
  list: () => ["clientOrganizations", "list"] as const,
};

const candidateRevealsKeys = {
  all: ["candidateReveals"] as const,
  list: (clientOrgId?: string) => ["candidateReveals", "list", clientOrgId ?? null] as const,
};

// ---------------------------------------------------------------------------
// Subscription packages
// ---------------------------------------------------------------------------

export function useSubscriptionPackagesQuery() {
  return useQuery({
    queryKey: clientPackagesKeys.list(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscription_packages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SubscriptionPackage[];
    },
  });
}

export function useCreatePackageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: NewSubscriptionPackage) => {
      const { error } = await (supabase as any).from("subscription_packages").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientPackagesKeys.all });
      toast.success("تم إنشاء الباقة");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePackageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<NewSubscriptionPackage> }) => {
      const { error } = await (supabase as any)
        .from("subscription_packages")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientPackagesKeys.all });
      toast.success("تم تحديث الباقة");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePackageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("subscription_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientPackagesKeys.all });
      toast.success("تم حذف الباقة");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Client organizations
// ---------------------------------------------------------------------------

export function useClientOrganizationsQuery() {
  return useQuery({
    queryKey: clientOrgsKeys.list(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_organizations")
        .select("*, subscription_packages(name_ar, name_en, credits_included)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientOrganization[];
    },
  });
}

export function useCreateClientOrgMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewClientOrgInput) => {
      const { data: pkg, error: pkgError } = await (supabase as any)
        .from("subscription_packages")
        .select("credits_included, duration_months")
        .eq("id", input.package_id)
        .single();
      if (pkgError) throw pkgError;

      const startsAt = new Date();
      const expiresAt = new Date(startsAt);
      expiresAt.setMonth(expiresAt.getMonth() + Number(pkg?.duration_months || 0));

      const { error } = await (supabase as any).from("client_organizations").insert({
        name: input.name,
        contact_email: input.contact_email || null,
        contact_phone: input.contact_phone || null,
        package_id: input.package_id,
        notes: input.notes || null,
        credits_remaining: pkg?.credits_included ?? 0,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        subscription_status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientOrgsKeys.all });
      toast.success("تم إنشاء الشركة المستأجرة");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateClientOrgMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ClientOrganization> }) => {
      // Strip the nested join key if it happens to be passed through by callers.
      const { subscription_packages, ...rest } = patch as any;
      const { error } = await (supabase as any)
        .from("client_organizations")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientOrgsKeys.all });
      toast.success("تم التحديث");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRenewClientOrgMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, packageId }: { id: string; packageId: string }) => {
      const [{ data: pkg, error: pkgError }, { data: org, error: orgError }] = await Promise.all([
        (supabase as any)
          .from("subscription_packages")
          .select("credits_included, duration_months")
          .eq("id", packageId)
          .single(),
        (supabase as any)
          .from("client_organizations")
          .select("credits_remaining, expires_at")
          .eq("id", id)
          .single(),
      ]);
      if (pkgError) throw pkgError;
      if (orgError) throw orgError;

      const now = new Date();
      const currentExpiry = org?.expires_at ? new Date(org.expires_at) : now;
      const base = currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(base);
      newExpiry.setMonth(newExpiry.getMonth() + Number(pkg?.duration_months || 0));

      const newCredits = Number(org?.credits_remaining || 0) + Number(pkg?.credits_included || 0);

      const { error } = await (supabase as any)
        .from("client_organizations")
        .update({
          package_id: packageId,
          credits_remaining: newCredits,
          expires_at: newExpiry.toISOString(),
          subscription_status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientOrgsKeys.all });
      toast.success("تم تجديد الاشتراك");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteClientOrgMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("client_organizations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientOrgsKeys.all });
      toast.success("تم حذف الشركة");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Candidate reveals (admin analytics)
// ---------------------------------------------------------------------------

export function useCandidateRevealsQuery(clientOrgId?: string) {
  return useQuery({
    queryKey: candidateRevealsKeys.list(clientOrgId),
    queryFn: async () => {
      let query = (supabase as any)
        .from("candidate_reveals")
        .select("*")
        .order("revealed_at", { ascending: false });
      if (clientOrgId) query = query.eq("client_organization_id", clientOrgId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CandidateReveal[];
    },
  });
}
