import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

const KIND_TO_COLUMN: Record<string, string> = {
  resume: "resume_url",
  degree: "degree_url",
  training: "training_certs_url",
  other: "other_docs_url",
};

export interface ExternalBackupKindStatus {
  kind: string;
  total: number;
  backedUp: number;
  failed: number;
}

export interface ExternalBackupStatus {
  byKind: ExternalBackupKindStatus[];
  lastBackedUpAt: string | null;
}

async function countCandidates(column: string): Promise<number> {
  const { count } = await (supabase as any)
    .from("applicants")
    .select("id", { count: "exact", head: true })
    .not(column, "is", null);
  return count ?? 0;
}

async function countBackups(kind: string, status: "success" | "error"): Promise<number> {
  const { count } = await (supabase as any)
    .from("external_backups")
    .select("id", { count: "exact", head: true })
    .eq("destination", "onedrive")
    .eq("file_kind", kind)
    .eq("status", status);
  return count ?? 0;
}

async function fetchExternalBackupStatus(): Promise<ExternalBackupStatus> {
  const kinds = Object.keys(KIND_TO_COLUMN);

  const [byKind, lastRes] = await Promise.all([
    Promise.all(
      kinds.map(async (kind) => {
        const [total, backedUp, failed] = await Promise.all([
          countCandidates(KIND_TO_COLUMN[kind]),
          countBackups(kind, "success"),
          countBackups(kind, "error"),
        ]);
        return { kind, total, backedUp, failed };
      })
    ),
    (supabase as any)
      .from("external_backups")
      .select("backed_up_at")
      .eq("destination", "onedrive")
      .order("backed_up_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    byKind: byKind.filter((k) => k.total > 0 || k.backedUp > 0 || k.failed > 0),
    lastBackedUpAt: lastRes?.data?.backed_up_at ?? null,
  };
}

export function useExternalBackupStatusQuery() {
  return useQuery({
    queryKey: queryKeys.externalBackups.status(),
    queryFn: fetchExternalBackupStatus,
    staleTime: 60_000,
  });
}
