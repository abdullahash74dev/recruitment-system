import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/** One active filter chip, e.g. { field: "nationality", value: "Saudi" }. */
export interface ClientFilterValue {
  field: string;
  value: string;
}

/** Row shape returned by the `client-search-applicants` edge function. Phone/email
 * arrive already masked server-side unless `is_revealed` is true — this layer never
 * re-masks or re-derives anything, it just displays what the function sent back. */
export interface ClientApplicantRow {
  id: string;
  full_name: string;
  desired_position: string | null;
  nationality: string | null;
  preferred_city: string | null;
  current_city: string | null;
  education_level: string | null;
  years_experience: string | null;
  current_title: string | null;
  job_type: string | null;
  created_at: string;
  is_revealed: boolean;
  has_resume: boolean;
  /** Signed download URL, only ever populated after a reveal (same credit as phone/email). */
  resume_url?: string | null;
  phone: string | null;
  email: string | null;
}

/** One distinct-value facet entry from `client-portal-facets`, e.g. a single
 * literal value or a synonym-group match (`isGroup: true`, `value` is an
 * opaque `__canon__:...` token, `label` is the human-readable canonical name). */
export interface ClientFacetValue {
  value: string;
  count: number;
  label: string;
  isGroup?: boolean;
}

export type ClientSearchMode = "any" | "all";

export interface ClientSearchResult {
  rows: ClientApplicantRow[];
  total: number;
  credits_remaining: number;
}

export const CLIENT_PORTAL_PAGE_SIZE = 20;

interface EdgeFunctionErrorInfo {
  status?: number;
  message: string;
}

/**
 * supabase-js surfaces edge-function failures as a `FunctionsHttpError` whose
 * `.context` is the raw Response — the real status code + JSON `{ error }` body
 * live there, not on `.message`. Mirrors the extraction used in
 * ApplicationForm.tsx so 402/403 handling below can branch on `status`.
 */
async function extractEdgeFunctionError(error: unknown): Promise<EdgeFunctionErrorInfo> {
  if (typeof error === "object" && error !== null && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const status = context.status;
      try {
        const raw = await context.text();
        if (raw.trim()) {
          try {
            const parsed = JSON.parse(raw) as { error?: string; message?: string };
            const msg = parsed.error || parsed.message;
            if (msg) return { status, message: msg };
          } catch {
            return { status, message: raw };
          }
        }
      } catch {
        // fall through to statusText below
      }
      return { status, message: context.statusText || "Request failed" };
    }
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: string }).message;
    if (message?.trim()) return { message };
  }
  return { message: "Request failed" };
}

/**
 * Reactive search over `client-search-applicants` — the query key embeds
 * filters/search/page so any change refetches automatically. `staleTime` is kept
 * short (30s) since both matching results and the org's credit balance can shift
 * from other reveals (this session or a teammate's) between renders.
 */
export function useClientSearchQuery(
  filters: ClientFilterValue[],
  search: string,
  page: number,
  lang: "ar" | "en" = "ar",
  searchMode: ClientSearchMode = "any",
) {
  return useQuery({
    queryKey: queryKeys.clientPortal.search(filters, search, page, searchMode),
    queryFn: async (): Promise<ClientSearchResult> => {
      const { data, error } = await supabase.functions.invoke("client-search-applicants", {
        body: { filters, search, searchMode, page, pageSize: CLIENT_PORTAL_PAGE_SIZE },
      });
      if (error) {
        const { message } = await extractEdgeFunctionError(error);
        toast.error(message || (lang === "ar" ? "تعذر تحميل نتائج البحث" : "Failed to load search results"));
        throw new Error(message);
      }
      return data as ClientSearchResult;
    },
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev, // keep the previous page on screen while a new page/filter loads
  });
}

/**
 * Distinct-value counts for one filterable field via `client-portal-facets`,
 * scoped by every OTHER currently-applied filter (faceted counting — picking
 * a nationality narrows the counts shown for city, etc). `enabled` lets the
 * caller only fetch once a field's row is actually expanded in the UI.
 */
async function fetchFacetValues(
  field: string,
  otherFilters: ClientFilterValue[],
  lang: "ar" | "en",
): Promise<ClientFacetValue[]> {
  const { data, error } = await supabase.functions.invoke("client-portal-facets", {
    body: { field, filters: otherFilters },
  });
  if (error) {
    const { message } = await extractEdgeFunctionError(error);
    toast.error(message || (lang === "ar" ? "تعذر تحميل خيارات الفلتر" : "Failed to load filter options"));
    throw new Error(message);
  }
  return (data as { values: ClientFacetValue[] }).values;
}

export function useClientFacetsQuery(
  field: string,
  otherFilters: ClientFilterValue[],
  enabled: boolean,
  lang: "ar" | "en" = "ar",
) {
  return useQuery({
    queryKey: queryKeys.clientPortal.facets(field, otherFilters),
    queryFn: () => fetchFacetValues(field, otherFilters, lang),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Imperative counterpart of useClientFacetsQuery, for CategorizedFilterPanel's
 * synchronous `getDistinctValues(field)` contract — that callback can't itself
 * be async, so the panel's host page calls this to warm react-query's cache
 * (dedup'd by queryKey, so an already-in-flight or cached field/otherFilters
 * combo never double-fetches) and re-reads via queryClient.getQueryData once
 * it resolves.
 */
export function fetchClientFacets(
  queryClient: QueryClient,
  field: string,
  otherFilters: ClientFilterValue[],
  lang: "ar" | "en" = "ar",
) {
  return queryClient.fetchQuery({
    queryKey: queryKeys.clientPortal.facets(field, otherFilters),
    queryFn: () => fetchFacetValues(field, otherFilters, lang),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Reveals one candidate's real phone/email via `reveal-candidate`. On success,
 * patches every cached `clientPortal.search` query (any page/filter/search combo)
 * in place — flips `is_revealed` + swaps in the real contact info for that one row
 * and refreshes `credits_remaining` — so the table updates instantly without a
 * full re-search. On a 402/403 failure, surfaces the specific reason via toast.
 */
export function useRevealCandidateMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (applicantId: string) => {
      const { data, error } = await supabase.functions.invoke("reveal-candidate", {
        body: { applicant_id: applicantId },
      });
      if (error) {
        const { status, message } = await extractEdgeFunctionError(error);
        const err = new Error(message) as Error & { status?: number };
        err.status = status;
        throw err;
      }
      return data as { phone: string; email: string; resume_url: string | null; credits_remaining: number };
    },
    onSuccess: (data, applicantId) => {
      queryClient.setQueriesData<ClientSearchResult>(
        { queryKey: queryKeys.clientPortal.searchAll, exact: false },
        (old) => {
          if (!old || !Array.isArray(old.rows)) return old;
          return {
            ...old,
            credits_remaining: data.credits_remaining,
            rows: old.rows.map((row) =>
              row.id === applicantId
                ? { ...row, is_revealed: true, phone: data.phone, email: data.email, resume_url: data.resume_url }
                : row
            ),
          };
        }
      );
      toast.success(
        ar
          ? `تم كشف بيانات الاتصال — الرصيد المتبقي: ${data.credits_remaining} كشف`
          : `Contact info revealed — ${data.credits_remaining} reveals remaining`
      );
    },
    onError: (error: Error & { status?: number }) => {
      if (error.status === 402) {
        toast.error(ar ? "لا يوجد رصيد كافٍ لكشف البيانات" : "Insufficient credits to reveal this candidate");
      } else if (error.status === 403) {
        toast.error(ar ? "انتهت صلاحية الاشتراك" : "Your subscription has expired");
      } else {
        toast.error(error.message || (ar ? "تعذر كشف بيانات الاتصال" : "Failed to reveal contact info"));
      }
    },
  });
}

interface BulkRevealResult {
  revealed: {
    applicant_id: string;
    phone: string | null;
    email: string | null;
    resume_url: string | null;
  }[];
  failed: { applicant_id: string; reason: "not_found" | "no_credits" | "error" }[];
  credits_remaining: number;
}

/**
 * Reveals multiple candidates in one request via `reveal-candidates-bulk`.
 * The function itself stops charging credits once the org's balance hits 0
 * (later ids come back in `failed` with reason "no_credits") rather than
 * failing the whole batch -- so this always patches whatever DID succeed
 * into the cache, even on a partial result, and reports the split via toast.
 */
export function useBulkRevealCandidatesMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (applicantIds: string[]): Promise<BulkRevealResult> => {
      const { data, error } = await supabase.functions.invoke("reveal-candidates-bulk", {
        body: { applicant_ids: applicantIds },
      });
      if (error) {
        const { status, message } = await extractEdgeFunctionError(error);
        const err = new Error(message) as Error & { status?: number };
        err.status = status;
        throw err;
      }
      return data as BulkRevealResult;
    },
    onSuccess: (data) => {
      if (data.revealed.length > 0) {
        const revealedById = new Map(data.revealed.map((r) => [r.applicant_id, r]));
        queryClient.setQueriesData<ClientSearchResult>(
          { queryKey: queryKeys.clientPortal.searchAll, exact: false },
          (old) => {
            if (!old || !Array.isArray(old.rows)) return old;
            return {
              ...old,
              credits_remaining: data.credits_remaining,
              rows: old.rows.map((row) => {
                const r = revealedById.get(row.id);
                return r ? { ...row, is_revealed: true, phone: r.phone, email: r.email, resume_url: r.resume_url } : row;
              }),
            };
          }
        );
      }

      const noCreditsCount = data.failed.filter((f) => f.reason === "no_credits").length;
      if (data.revealed.length > 0 && data.failed.length === 0) {
        toast.success(
          ar
            ? `تم كشف ${data.revealed.length} مرشح — الرصيد المتبقي: ${data.credits_remaining}`
            : `Revealed ${data.revealed.length} candidates — ${data.credits_remaining} reveals remaining`
        );
      } else if (data.revealed.length > 0 && noCreditsCount > 0) {
        toast.warning(
          ar
            ? `كُشف ${data.revealed.length} مرشح، وتوقف الباقي (${noCreditsCount}) لنفاد الرصيد`
            : `Revealed ${data.revealed.length}, stopped for the rest (${noCreditsCount}) -- out of credits`
        );
      } else if (data.revealed.length === 0 && noCreditsCount > 0) {
        toast.error(ar ? "لا يوجد رصيد كافٍ لكشف أي من المحدد" : "Not enough credits to reveal any of the selection");
      }
    },
    onError: (error: Error & { status?: number }) => {
      if (error.status === 403) {
        toast.error(ar ? "انتهت صلاحية الاشتراك" : "Your subscription has expired");
      } else {
        toast.error(error.message || (ar ? "تعذر تنفيذ الكشف الجماعي" : "Bulk reveal failed"));
      }
    },
  });
}
