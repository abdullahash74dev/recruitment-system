import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface JobPosting {
  id: string;
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  location: string;
  location_en: string | null;
  job_type: string;
  job_type_en: string | null;
  department: string | null;
  department_en: string | null;
  requirements_ar: string | null;
  requirements_en: string | null;
  is_active: boolean;
  nationality_required: string | null;
  nationality_required_en: string | null;
  vacancy_count: number;
  created_at: string;
}

async function fetchJobPostings(): Promise<JobPosting[]> {
  const { data, error } = await supabase
    .from("job_postings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as JobPosting[];
}

export function useJobPostingsQuery() {
  return useQuery({
    queryKey: queryKeys.jobPostings.list(),
    queryFn: fetchJobPostings,
  });
}

/**
 * Insert when `id` is absent, update when present — mirrors the original
 * `saveJob`'s `editingJob ? update : insert` branch.
 */
export function useSaveJobPostingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const { error } = id
        ? await supabase.from("job_postings").update(payload).eq("id", id)
        : await supabase.from("job_postings").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobPostings.all });
    },
  });
}

export function useDeleteJobPostingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("job_postings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobPostings.all });
    },
  });
}

export function useToggleJobPostingActiveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("job_postings").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobPostings.all });
    },
  });
}
