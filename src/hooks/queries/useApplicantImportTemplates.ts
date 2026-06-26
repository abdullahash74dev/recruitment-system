import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Saved mapping templates for ApplicantsMappedImport — fetched only while the
 * import dialog is open (mirrors the original `if (open) loadTemplates()` effect).
 */
export function useApplicantImportTemplatesQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.applicantImportTemplates.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicant_import_templates")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled,
  });
}

/** Mirrors the original ApplicantsMappedImport `saveAsTemplate()` upsert. */
export function useUpsertApplicantImportTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; mapping_snapshot: Record<string, unknown> }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("applicant_import_templates").upsert(
        {
          name: params.name,
          mapping_snapshot: params.mapping_snapshot,
          created_by: userData.user?.id || null,
          created_by_email: userData.user?.email || null,
        },
        { onConflict: "name" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applicantImportTemplates.all });
    },
  });
}

/** Mirrors the original ApplicantsMappedImport `deleteTemplate()` delete. */
export function useDeleteApplicantImportTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("applicant_import_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applicantImportTemplates.all });
    },
  });
}
