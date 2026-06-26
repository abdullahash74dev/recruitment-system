import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Combined list fetch used by the Job Advertisements admin screen:
 * - active job postings (for the "pick a system job" list)
 * - saved job advertisements (for the "saved ads" list / editor)
 *
 * Mirrors the original `loadAll()` logic exactly (same tables, same
 * `.select()`/`.order()`/`.eq()` filters, same `Promise.all` shape).
 */
export interface JobAdvertisementsListResult {
  jobs: any[];
  ads: any[];
}

async function fetchJobAdvertisementsList(): Promise<JobAdvertisementsListResult> {
  const [jobsRes, adsRes] = await Promise.all([
    supabase.from("job_postings").select("*").eq("is_active", true).order("created_at", { ascending: false }),
    supabase.from("job_advertisements").select("*").order("created_at", { ascending: false }),
  ]);
  return {
    jobs: jobsRes.data ? (jobsRes.data as any) : [],
    ads: adsRes.data ? (adsRes.data as any) : [],
  };
}

export function useJobAdvertisementsQuery() {
  return useQuery({
    queryKey: queryKeys.jobAdvertisements.list(),
    queryFn: fetchJobAdvertisementsList,
  });
}

/**
 * Insert payload mirrors the `payload` object built in the original
 * `handleSave()` (same fields, same shapes, including `ai_metadata`).
 */
export interface JobAdvertisementPayload {
  title_ar: string;
  title_en: string | null;
  subtitle_ar: string | null;
  subtitle_en: string | null;
  job_ids: string[];
  manual_jobs: any;
  design_style: string;
  layout_type: string;
  accent_color: string;
  secondary_color: string;
  text_color: string;
  logo_url: string | null;
  background_url: string | null;
  show_qr: boolean;
  qr_url: string | null;
  notes: string | null;
  created_by: string | undefined;
  created_by_email: string | undefined;
  ai_metadata: any;
}

/**
 * Creates a new job advertisement (the `else` branch of the original
 * `handleSave()` — used when there is no `editingId`).
 */
export function useCreateJobAdvertisement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: JobAdvertisementPayload) => {
      const { error } = await supabase.from("job_advertisements").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobAdvertisements.all });
    },
  });
}

/**
 * Updates an existing job advertisement (the `if (editingId)` branch of
 * the original `handleSave()`).
 */
export function useUpdateJobAdvertisement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: JobAdvertisementPayload }) => {
      const { error } = await supabase.from("job_advertisements").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobAdvertisements.all });
    },
  });
}

/**
 * Deletes a job advertisement (the original `handleDelete()` body, minus
 * the `confirm()` dialog which stays at the call site).
 */
export function useDeleteJobAdvertisement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("job_advertisements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobAdvertisements.all });
    },
  });
}
