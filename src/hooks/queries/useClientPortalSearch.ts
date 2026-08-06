import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  phone: string | null;
  email: string | null;
}

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
) {
  return useQuery({
    queryKey: queryKeys.clientPortal.search(filters, search, page),
    queryFn: async (): Promise<ClientSearchResult> => {
      const { data, error } = await supabase.functions.invoke("client-search-applicants", {
        body: { filters, search, page, pageSize: CLIENT_PORTAL_PAGE_SIZE },
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
      return data as { phone: string; email: string; credits_remaining: number };
    },
    onSuccess: (data, applicantId) => {
      queryClient.setQueriesData<ClientSearchResult>(
        { queryKey: queryKeys.clientPortal.all, exact: false },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            credits_remaining: data.credits_remaining,
            rows: old.rows.map((row) =>
              row.id === applicantId
                ? { ...row, is_revealed: true, phone: data.phone, email: data.email }
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
