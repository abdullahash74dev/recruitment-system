import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// client_candidate_folders / _folder_items / _notes / _status are new tables
// not yet in the generated Supabase types, so every call below casts
// `supabase as any` -- same pattern as useClientSavedFilters.ts. RLS (not an
// edge function) scopes every row to the caller's own client_organization_id;
// none of this touches masked applicant PII, it's the client org's own
// organizational metadata about candidates they've already revealed.

export interface ClientCandidateFolder {
  id: string;
  name: string;
  created_at: string;
}

const FOLDERS_KEY = ["clientPortal", "folders"] as const;
const FOLDER_ITEMS_KEY = (folderId: string) => ["clientPortal", "folderItems", folderId] as const;

export function useClientCandidateFoldersQuery() {
  return useQuery({
    queryKey: FOLDERS_KEY,
    queryFn: async (): Promise<ClientCandidateFolder[]> => {
      const { data, error } = await (supabase as any)
        .from("client_candidate_folders")
        .select("id, name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ClientCandidateFolder[];
    },
  });
}

export function useCreateFolderMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(ar ? "الجلسة منتهية" : "Session expired");
      const { data: clientUser, error: cuError } = await (supabase as any)
        .from("client_users").select("client_organization_id").eq("user_id", user.id).maybeSingle();
      if (cuError || !clientUser) throw new Error(ar ? "تعذر تحديد الشركة" : "Could not resolve organization");
      const { error } = await (supabase as any).from("client_candidate_folders").insert({
        name, client_organization_id: clientUser.client_organization_id, created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
      toast.success(ar ? "تم إنشاء المجلد" : "Folder created");
    },
    onError: (e: Error) => toast.error(e.message || (ar ? "تعذر إنشاء المجلد" : "Failed to create folder")),
  });
}

export function useDeleteFolderMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("client_candidate_folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
      toast.success(ar ? "تم حذف المجلد" : "Folder deleted");
    },
    onError: (e: Error) => toast.error(e.message || (ar ? "تعذر حذف المجلد" : "Failed to delete folder")),
  });
}

export function useFolderItemsQuery(folderId: string | null) {
  return useQuery({
    queryKey: FOLDER_ITEMS_KEY(folderId ?? ""),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase as any)
        .from("client_candidate_folder_items").select("applicant_id").eq("folder_id", folderId);
      if (error) throw error;
      return (data || []).map((r: { applicant_id: string }) => r.applicant_id);
    },
    enabled: !!folderId,
  });
}

/** All (folder_id -> Set<applicant_id>) membership for the org's folders, in
 * one query -- used to show "which folders is this candidate already in"
 * checkboxes without a per-folder round trip. */
export function useAllFolderMembershipQuery() {
  return useQuery({
    queryKey: ["clientPortal", "folderItems", "all"],
    queryFn: async (): Promise<Record<string, string[]>> => {
      const { data, error } = await (supabase as any)
        .from("client_candidate_folder_items").select("folder_id, applicant_id");
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of (data || []) as { folder_id: string; applicant_id: string }[]) {
        (map[row.folder_id] ||= []).push(row.applicant_id);
      }
      return map;
    },
  });
}

export function useToggleFolderItemMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async ({ folderId, applicantId, add }: { folderId: string; applicantId: string; add: boolean }) => {
      if (add) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error(ar ? "الجلسة منتهية" : "Session expired");
        const { error } = await (supabase as any).from("client_candidate_folder_items").insert({
          folder_id: folderId, applicant_id: applicantId, added_by: user.id,
        });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("client_candidate_folder_items").delete().eq("folder_id", folderId).eq("applicant_id", applicantId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientPortal", "folderItems"] });
    },
    onError: (e: Error) => toast.error(e.message || (ar ? "تعذر التحديث" : "Failed to update")),
  });
}

// ---- Notes ----

export function useCandidateNoteQuery(applicantId: string | null) {
  return useQuery({
    queryKey: ["clientPortal", "note", applicantId],
    queryFn: async (): Promise<string> => {
      const { data, error } = await (supabase as any)
        .from("client_candidate_notes").select("note").eq("applicant_id", applicantId).maybeSingle();
      if (error) throw error;
      return data?.note ?? "";
    },
    enabled: !!applicantId,
  });
}

export function useSaveCandidateNoteMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async ({ applicantId, note }: { applicantId: string; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(ar ? "الجلسة منتهية" : "Session expired");
      const { data: clientUser, error: cuError } = await (supabase as any)
        .from("client_users").select("client_organization_id").eq("user_id", user.id).maybeSingle();
      if (cuError || !clientUser) throw new Error(ar ? "تعذر تحديد الشركة" : "Could not resolve organization");
      const { error } = await (supabase as any).from("client_candidate_notes").upsert(
        { client_organization_id: clientUser.client_organization_id, applicant_id: applicantId, note, updated_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: "client_organization_id,applicant_id" }
      );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["clientPortal", "note", vars.applicantId] });
      toast.success(ar ? "تم حفظ الملاحظة" : "Note saved");
    },
    onError: (e: Error) => toast.error(e.message || (ar ? "تعذر حفظ الملاحظة" : "Failed to save note")),
  });
}

// ---- Internal follow-up status ----

export type ClientCandidateStatus = "contacted" | "interview_scheduled" | "hired" | "rejected";

export function useCandidateStatusQuery(applicantId: string | null) {
  return useQuery({
    queryKey: ["clientPortal", "status", applicantId],
    queryFn: async (): Promise<ClientCandidateStatus | null> => {
      const { data, error } = await (supabase as any)
        .from("client_candidate_status").select("status").eq("applicant_id", applicantId).maybeSingle();
      if (error) throw error;
      return (data?.status as ClientCandidateStatus | undefined) ?? null;
    },
    enabled: !!applicantId,
  });
}

export function useSetCandidateStatusMutation(lang: "ar" | "en" = "ar") {
  const queryClient = useQueryClient();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async ({ applicantId, status }: { applicantId: string; status: ClientCandidateStatus }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(ar ? "الجلسة منتهية" : "Session expired");
      const { data: clientUser, error: cuError } = await (supabase as any)
        .from("client_users").select("client_organization_id").eq("user_id", user.id).maybeSingle();
      if (cuError || !clientUser) throw new Error(ar ? "تعذر تحديد الشركة" : "Could not resolve organization");
      const { error } = await (supabase as any).from("client_candidate_status").upsert(
        { client_organization_id: clientUser.client_organization_id, applicant_id: applicantId, status, updated_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: "client_organization_id,applicant_id" }
      );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["clientPortal", "status", vars.applicantId] });
    },
    onError: (e: Error) => toast.error(e.message || (ar ? "تعذر تحديث الحالة" : "Failed to update status")),
  });
}

export const CLIENT_CANDIDATE_STATUS_LABELS: Record<ClientCandidateStatus, { ar: string; en: string }> = {
  contacted: { ar: "تم التواصل", en: "Contacted" },
  interview_scheduled: { ar: "مقابلة مجدولة", en: "Interview Scheduled" },
  hired: { ar: "تم التوظيف", en: "Hired" },
  rejected: { ar: "مرفوض", en: "Rejected" },
};
