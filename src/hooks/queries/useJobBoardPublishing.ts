import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useLanguage } from "@/contexts/LanguageContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobBoard =
  | "linkedin"
  | "indeed"
  | "bayt"
  | "naukrigulf"
  | "gulftalent"
  | "tanqeeb"
  | "google_jobs"
  | "custom";

export type PublicationStatus = "draft" | "queued" | "published" | "failed" | "expired" | "removed";

export interface JobBoardAccount {
  id: string;
  board: JobBoard;
  display_name: string | null;
  /** Company page slug / employer id / login e-mail — never a credential. */
  account_identifier: string | null;
  is_active: boolean | null;
  notes: string | null;
  created_at: string;
}

export interface JobBoardPublication {
  id: string;
  job_posting_id: string | null;
  job_title: string;
  board: JobBoard;
  external_url: string | null;
  external_id: string | null;
  status: PublicationStatus;
  published_at: string | null;
  expires_at: string | null;
  view_count: number | null;
  applicant_count: number | null;
  error_detail: string | null;
  published_by: string | null;
  created_at: string;
}

/** Trimmed job posting shape used to populate the publish dialog. */
export interface PublishableJobPosting {
  id: string;
  title_ar: string;
  title_en: string | null;
  is_active: boolean;
}

export interface CreatePublicationInput {
  job_posting_id?: string | null;
  job_title: string;
  /** One publication row is inserted per board. */
  boards: JobBoard[];
  external_url?: string | null;
  expires_at?: string | null;
}

export interface UpdatePublicationInput {
  id: string;
  patch: Partial<Omit<JobBoardPublication, "id" | "created_at">>;
}

/** Display order of the board grid — mirrors the migration's seed order. */
export const JOB_BOARDS: JobBoard[] = [
  "linkedin",
  "indeed",
  "bayt",
  "naukrigulf",
  "gulftalent",
  "tanqeeb",
  "google_jobs",
];

/** Fallback labels for boards with no display_name saved yet. */
export const BOARD_LABEL: Record<JobBoard, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  bayt: "Bayt.com",
  naukrigulf: "Naukrigulf",
  gulftalent: "GulfTalent",
  tanqeeb: "Tanqeeb",
  google_jobs: "Google Jobs",
  custom: "Custom",
};

// ---------------------------------------------------------------------------
// Board accounts
// ---------------------------------------------------------------------------

export function useJobBoardAccountsQuery() {
  return useQuery({
    queryKey: queryKeys.jobBoards.accounts(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("job_board_accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as JobBoardAccount[];
      // Keep the seeded order stable no matter how rows were inserted, so the
      // grid never reshuffles under the user after an edit.
      const rank = (b: JobBoard) => {
        const i = JOB_BOARDS.indexOf(b);
        return i === -1 ? JOB_BOARDS.length : i;
      };
      return [...rows].sort((a, b) => rank(a.board) - rank(b.board));
    },
  });
}

/**
 * Board rows are seeded by the migration, so this is an update keyed by `id`.
 * Toggling the switch and editing the identifier both go through here.
 */
export function useUpdateBoardAccountMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<JobBoardAccount> }) => {
      const body: Record<string, unknown> = { ...patch };
      delete body.id;
      delete body.created_at;
      delete body.board;

      const { error } = await (supabase as any).from("job_board_accounts").update(body).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobBoards.all });
      toast.success(ar ? "تم تحديث إعدادات الموقع" : "Board settings updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Publications
// ---------------------------------------------------------------------------

export function useJobBoardPublicationsQuery() {
  return useQuery({
    queryKey: queryKeys.jobBoards.publications(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("job_board_publications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as JobBoardPublication[];
    },
  });
}

/**
 * Active job postings offered as publish targets. Selected columns only — the
 * dialog needs a title and nothing else, and job_postings rows are wide.
 */
export function useJobPostingsForPublishingQuery() {
  return useQuery({
    // Derived from the module key so invalidating `jobBoards.all` also
    // refreshes the posting picker.
    queryKey: [...queryKeys.jobBoards.all, "postings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("job_postings")
        .select("id, title_ar, title_en, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as PublishableJobPosting[];
    },
  });
}

/**
 * Fans one job out to every selected board as a `draft` row. Publishing itself
 * is manual: no board API is called here (see the migration header), the rows
 * exist so the team can track what was posted where.
 */
export function useCreatePublicationMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (input: CreatePublicationInput) => {
      const title = input.job_title.trim();
      if (!title) throw new Error(ar ? "اسم الوظيفة مطلوب" : "Job title is required");
      if (!input.boards.length) throw new Error(ar ? "اختر موقعاً واحداً على الأقل" : "Select at least one board");

      const { data: userData } = await supabase.auth.getUser();
      const url = (input.external_url ?? "").trim() || null;

      const rows = input.boards.map((board) => ({
        job_posting_id: input.job_posting_id ?? null,
        job_title: title,
        board,
        external_url: url,
        status: "draft" as PublicationStatus,
        expires_at: input.expires_at || null,
        view_count: 0,
        applicant_count: 0,
        published_by: userData?.user?.id ?? null,
      }));

      const { error } = await (supabase as any).from("job_board_publications").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobBoards.all });
      toast.success(
        ar ? `تم إنشاء ${count} إعلان كمسودة` : `${count} listing${count === 1 ? "" : "s"} created as draft`
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePublicationMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async ({ id, patch }: UpdatePublicationInput) => {
      const { error } = await (supabase as any).from("job_board_publications").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobBoards.all });
      toast.success(ar ? "تم تحديث الإعلان" : "Listing updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePublicationMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("job_board_publications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobBoards.all });
      toast.success(ar ? "تم حذف الإعلان" : "Listing deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
