import { useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export type ApplicantStatus =
  | "new" | "reviewing" | "phone_interview" | "in_person_interview"
  | "accepted" | "hired" | "rejected" | "withdrawn";

export interface Applicant {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  desired_position: string | null;
  preferred_city: string | null;
  status: ApplicantStatus;
  notes: string | null;
  created_at: string;
  gender: string | null;
  nationality: string | null;
  education_level: string | null;
  years_experience: string | null;
  current_salary: string | null;
  expected_salary: string | null;
  job_type: string | null;
  major: string | null;
  university: string | null;
  current_title: string | null;
  linkedin: string | null;
  arabic_level: string | null;
  english_level: string | null;
  available_date: string | null;
  birth_date: string | null;
  marital_status: string | null;
  has_transport: string | null;
  current_city: string | null;
  dependents: number | null;
  gpa: string | null;
  graduation_year: string | null;
  self_summary: string | null;
  current_tasks: string | null;
  other_experience: string | null;
  other_language: string | null;
  hear_about: string | null;
  currently_employed: string | null;
  currently_studying: string | null;
  current_study: string | null;
  resume_url: string | null;
  degree_url: string | null;
  experience_cert_url: string | null;
  training_certs_url: string | null;
  other_docs_url: string | null;
  is_archived: boolean;
  archived_at: string | null;
  source?: string | null;
  source_company?: string | null;
}

export interface ApplicantsLoadProgress {
  loaded: number;
  total: number;
}

const APPLICANTS_QUERY_KEY = queryKeys.applicants.list();

/**
 * Streams the full `applicants` table the same way the original `fetchApplicants`
 * did: an instant first page for paint, then the rest in concurrent, retried,
 * timed-out background pages. Each step pushes the latest merged array into the
 * query cache via `setQueryData` so subscribers re-render as data lands, while
 * `onProgress`/`onFirstPaint` drive the UI-only loading/progress state (which has
 * different semantics than the queryFn's own pending/resolved lifecycle).
 */
async function fetchApplicantsProgressive(
  queryClient: QueryClient,
  onProgress: (p: ApplicantsLoadProgress) => void,
  onFirstPaintDone: () => void,
  lang: "ar" | "en",
): Promise<Applicant[]> {
  const FIRST_BATCH = 200; // small enough to land almost instantly, regardless of table size
  const PAGE_SIZE = 1000;
  const CONCURRENCY = 4; // fetch several pages at once, but not so many that a slow/mobile link gets saturated
  const PAGE_TIMEOUT_MS = 20000; // a single stalled request on a flaky connection must not freeze the whole load forever
  const MAX_RETRIES = 2;

  // First paint: grab just enough rows for page 1 of the table + rough stats, with an exact total count.
  const { data: firstData, error: firstError, count } = await supabase
    .from("applicants")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(0, FIRST_BATCH - 1);
  if (firstError) {
    toast.error(firstError.message);
    onFirstPaintDone();
    throw firstError;
  }
  const total = count || 0;
  const first = (firstData || []) as Applicant[];
  queryClient.setQueryData(APPLICANTS_QUERY_KEY, first);
  onProgress({ loaded: first.length, total });
  onFirstPaintDone();
  if (total <= first.length) return first; // already have everything

  // Background: stream in the rest in parallel batches, merging as each batch lands.
  // Each page gets its own timeout + a couple of retries so one bad request (common on
  // mobile data) can't hang the whole background load indefinitely.
  const fetchPage = async (from: number, to: number): Promise<Applicant[]> => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await Promise.race([
          supabase.from("applicants").select("*").order("created_at", { ascending: false }).range(from, to),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), PAGE_TIMEOUT_MS)),
        ]);
        if (result.error) throw result.error;
        return (result.data || []) as Applicant[];
      } catch (e) {
        if (attempt === MAX_RETRIES) {
          console.error(`Failed to load applicants range ${from}-${to} after ${MAX_RETRIES + 1} attempts`, e);
          return [];
        }
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); // backoff before retrying
      }
    }
    return [];
  };

  const remainingStart = first.length;
  const pageCount = Math.ceil((total - remainingStart) / PAGE_SIZE);
  const pages: Applicant[][] = new Array(pageCount);
  let loaded = first.length;
  let failedPages = 0;
  for (let start = 0; start < pageCount; start += CONCURRENCY) {
    const batch = Array.from({ length: Math.min(CONCURRENCY, pageCount - start) }, (_, i) => start + i);
    const results = await Promise.all(batch.map(p => {
      const from = remainingStart + p * PAGE_SIZE;
      return fetchPage(from, from + PAGE_SIZE - 1);
    }));
    for (let i = 0; i < results.length; i++) {
      pages[batch[i]] = results[i];
      loaded += results[i].length;
      if (results[i].length === 0) failedPages++;
    }
    const merged = [...first, ...pages.flat()];
    queryClient.setQueryData(APPLICANTS_QUERY_KEY, merged);
    onProgress({ loaded, total });
  }
  if (failedPages > 0) {
    onProgress({ loaded: total, total }); // stop showing "still loading" — we're done retrying
    toast.error(
      lang === "ar"
        ? `تعذّر تحميل بعض البيانات (${failedPages} صفحة) بسبب ضعف الاتصال — أعد تحميل الصفحة للمحاولة مجدداً`
        : `Some data (${failedPages} page${failedPages > 1 ? "s" : ""}) failed to load due to a weak connection — refresh to retry`
    );
  }
  return [...first, ...pages.flat()];
}

/**
 * Wraps the original progressive applicants loader in `useQuery` so the result
 * survives navigation/remounts within the session (no persistence to localStorage
 * — this list is too large/volatile for that, matching the original "fetch once
 * per mount" behavior on a hard refresh).
 */
export function useApplicantsQuery(lang: "ar" | "en") {
  const queryClient = useQueryClient();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState<ApplicantsLoadProgress>({ loaded: 0, total: 0 });

  const query = useQuery({
    queryKey: APPLICANTS_QUERY_KEY,
    queryFn: () => {
      setIsInitialLoading(true);
      setLoadProgress({ loaded: 0, total: 0 });
      return fetchApplicantsProgressive(queryClient, setLoadProgress, () => setIsInitialLoading(false), lang);
    },
    staleTime: Infinity,
    meta: { persist: false },
  });

  return {
    applicants: query.data ?? [],
    isLoading: isInitialLoading,
    loadProgress,
    refetch: query.refetch,
  };
}

function patchApplicant(queryClient: QueryClient, id: string, patch: Partial<Applicant>) {
  queryClient.setQueryData<Applicant[]>(APPLICANTS_QUERY_KEY, (prev) =>
    (prev ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a))
  );
}

export function useUpdateApplicantStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ApplicantStatus }) => {
      const { error } = await supabase.from("applicants").update({ status }).eq("id", id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: ({ id, status }) => patchApplicant(queryClient, id, { status }),
  });
}

export function useUpdateApplicantNotesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from("applicants").update({ notes }).eq("id", id);
      if (error) throw error;
      return { id, notes };
    },
    onSuccess: ({ id, notes }) => patchApplicant(queryClient, id, { notes }),
  });
}

export function useArchiveApplicantMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const archived_at = new Date().toISOString();
      const { error } = await supabase.from("applicants").update({ is_archived: true, archived_at }).eq("id", id);
      if (error) throw error;
      return { id, archived_at };
    },
    onSuccess: ({ id, archived_at }) => patchApplicant(queryClient, id, { is_archived: true, archived_at }),
  });
}

export function useRestoreApplicantMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("applicants").update({ is_archived: false, archived_at: null }).eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => patchApplicant(queryClient, id, { is_archived: false, archived_at: null }),
  });
}
