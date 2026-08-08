import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

const KIND_TO_COLUMN: Record<string, string> = {
  resume: "resume_url",
  degree: "degree_url",
  training: "training_certs_url",
  other: "other_docs_url",
};

// Destinations the shipped scripts/*-backup tools write to. Both write to
// the same external_backups table, distinguished by this column, so they
// can run independently without stepping on each other.
export const EXTERNAL_BACKUP_DESTINATIONS = ["onedrive", "googledrive"] as const;

export interface ExternalBackupKindStatus {
  kind: string;
  total: number;
  backedUp: number;
  failed: number;
}

export interface ExternalBackupDestinationStatus {
  destination: string;
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

async function countBackups(destination: string, kind: string, status: "success" | "error"): Promise<number> {
  const { count } = await (supabase as any)
    .from("external_backups")
    .select("id", { count: "exact", head: true })
    .eq("destination", destination)
    .eq("file_kind", kind)
    .eq("status", status);
  return count ?? 0;
}

async function fetchExternalBackupStatus(): Promise<ExternalBackupDestinationStatus[]> {
  const kinds = Object.keys(KIND_TO_COLUMN);

  const totals = await Promise.all(kinds.map((kind) => countCandidates(KIND_TO_COLUMN[kind])));
  const totalByKind = Object.fromEntries(kinds.map((kind, i) => [kind, totals[i]]));

  return Promise.all(
    EXTERNAL_BACKUP_DESTINATIONS.map(async (destination) => {
      const [byKind, lastRes] = await Promise.all([
        Promise.all(
          kinds.map(async (kind) => {
            const [backedUp, failed] = await Promise.all([
              countBackups(destination, kind, "success"),
              countBackups(destination, kind, "error"),
            ]);
            return { kind, total: totalByKind[kind], backedUp, failed };
          })
        ),
        (supabase as any)
          .from("external_backups")
          .select("backed_up_at")
          .eq("destination", destination)
          .order("backed_up_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        destination,
        byKind: byKind.filter((k) => k.total > 0),
        lastBackedUpAt: lastRes?.data?.backed_up_at ?? null,
      };
    })
  );
}

export function useExternalBackupStatusQuery() {
  return useQuery({
    queryKey: queryKeys.externalBackups.status(),
    queryFn: fetchExternalBackupStatus,
    staleTime: 60_000,
  });
}
