import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface BucketUsage {
  count: number;
  failed: number;
  checksumMismatches?: number;
}

export interface BackupRun {
  id: string;
  status: string;
  file_path: string | null;
  file_size: number | null;
  backup_folder: string | null;
  tables_summary: Record<string, number> | null;
  buckets_summary: Record<string, BucketUsage> | null;
  triggered_by: string;
  error_message: string | null;
  created_at: string;
  checksum_issues: number;
  offsite_status: string | null;
}

export interface RestoreApproval {
  id: string;
  backup_folder: string;
  tables: string[] | null;
  include_files: boolean;
  status: string;
  requested_by: string;
  requested_by_email: string | null;
  created_at: string;
  expires_at: string;
}

// NOTE: restore_approvals and app_secrets are distinct entities from backup
// runs (a pending-approval queue and a generic key/value secrets store,
// respectively). There is no dedicated query key for either in
// src/lib/queryKeys.ts yet. They're temporarily nested here under
// queryKeys.backupRuns so invalidation stays centralized, but a real fix
// should add e.g. `restoreApprovals` and `appSecrets` entries to the key
// factory — see report for details.

// ---------------------------------------------------------------------------
// Backup runs (history list)
// ---------------------------------------------------------------------------

async function fetchBackupRuns(): Promise<BackupRun[]> {
  const { data, error } = await supabase
    .from("backup_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data as BackupRun[]) || [];
}

export function useBackupRunsQuery() {
  return useQuery({
    queryKey: queryKeys.backupRuns.list(),
    queryFn: fetchBackupRuns,
  });
}

export function useTriggerBackupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("scheduled-backup", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backupRuns.all });
    },
  });
}

export function useDownloadBackupMutation() {
  return useMutation({
    mutationFn: async (run: BackupRun) => {
      if (!run.file_path) return null;
      const { data, error } = await supabase.storage.from("backups").createSignedUrl(run.file_path, 60);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  });
}

interface RestoreBackupParams {
  backup_folder: string;
  mode: "merge" | "replace";
  includeFiles: boolean;
}

export function useRestoreBackupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ backup_folder, mode, includeFiles }: RestoreBackupParams) => {
      const { data, error } = await supabase.functions.invoke("restore-backup", {
        body: { backup_folder, mode, includeFiles, confirm: "RESTORE" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backupRuns.all });
      queryClient.invalidateQueries({ queryKey: restoreApprovalsKey });
    },
  });
}

// ---------------------------------------------------------------------------
// Restore approvals (pending full-replace requests)
// ---------------------------------------------------------------------------

// Temporary local key — see NOTE above re: queryKeys.ts not having an entry
// for this entity yet.
const restoreApprovalsKey = ["backupRuns", "restoreApprovals"] as const;

async function fetchPendingRestoreApprovals(): Promise<RestoreApproval[]> {
  const { data, error } = await supabase
    .from("restore_approvals")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as RestoreApproval[]) || [];
}

export function useRestoreApprovalsQuery() {
  return useQuery({
    queryKey: restoreApprovalsKey,
    queryFn: fetchPendingRestoreApprovals,
  });
}

interface DecideRestoreApprovalParams {
  approval_id: string;
  action: "approve" | "reject";
}

export function useDecideRestoreApprovalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ approval_id, action }: DecideRestoreApprovalParams) => {
      const { data, error } = await supabase.functions.invoke("restore-backup", {
        body: { approval_id, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: restoreApprovalsKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.backupRuns.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Backup protection settings (app_secrets rows used by backup/restore)
// ---------------------------------------------------------------------------

export const BACKUP_SECRET_KEYS = {
  webhook: "alert_webhook_url",
  offsiteUrl: "offsite_supabase_url",
  offsiteKey: "offsite_supabase_service_key",
  offsiteIncludeFiles: "offsite_include_files",
} as const;

export interface BackupSecretsSettings {
  configured: Record<string, boolean>;
  offsiteIncludeFiles: boolean;
}

// Temporary local key — see NOTE above re: queryKeys.ts not having an entry
// for this entity yet.
const backupSecretsKey = ["backupRuns", "secrets"] as const;

async function fetchBackupSecretsSettings(): Promise<BackupSecretsSettings> {
  const { data, error } = await supabase
    .from("app_secrets")
    .select("key, value")
    .in("key", Object.values(BACKUP_SECRET_KEYS));
  if (error) throw error;
  const configured: Record<string, boolean> = {};
  let offsiteIncludeFiles = false;
  (data || []).forEach((row) => {
    if (row.key === BACKUP_SECRET_KEYS.offsiteIncludeFiles) offsiteIncludeFiles = row.value === "true";
    else configured[row.key] = true;
  });
  return { configured, offsiteIncludeFiles };
}

export function useBackupSecretsSettingsQuery() {
  return useQuery({
    queryKey: backupSecretsKey,
    queryFn: fetchBackupSecretsSettings,
  });
}

export function useSaveBackupSecretsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { key: string; value: string }[]) => {
      const { error } = await supabase.from("app_secrets").upsert(updates, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupSecretsKey });
    },
  });
}

// ---------------------------------------------------------------------------
// Manual data export (BackupSettings.tsx) — NOT part of the backup_runs
// domain. This reads arbitrary app tables (applicants, job_postings, etc.,
// each already owning its own query key elsewhere) and immediately
// serializes them to a downloaded file; nothing is cached or rendered, so
// there's no `backup_runs`/`backupRuns` cache entry to invalidate here. It's
// exposed as a mutation purely so the supabase calls live in the hooks layer
// like everything else, not because caching/staleness semantics apply.
// ---------------------------------------------------------------------------

export type ExportableTable =
  | "applicants"
  | "job_postings"
  | "custom_questions"
  | "custom_answers"
  | "projects"
  | "profiles";

// Paginated fetch: a flat .select("*") is silently capped at the platform's
// default row limit, which would make a backup report "success" while only
// capturing a fraction of large tables like applicants.
async function fetchAllRows(table: ExportableTable, orderBy?: string) {
  const PAGE_SIZE = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let q = supabase.from(table).select("*");
    if (orderBy) q = q.order(orderBy, { ascending: false });
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export interface ExportAllDataResult {
  applicants: any[];
  job_postings: any[];
  custom_questions: any[];
  custom_answers: any[];
  projects: any[];
  profiles: any[];
}

export function useExportAllDataMutation() {
  return useMutation({
    mutationFn: async (): Promise<ExportAllDataResult> => {
      const [applicants, jobPostings, customQuestions, customAnswers, projects, profiles] = await Promise.all([
        fetchAllRows("applicants", "created_at"),
        fetchAllRows("job_postings", "created_at"),
        fetchAllRows("custom_questions"),
        fetchAllRows("custom_answers"),
        fetchAllRows("projects"),
        fetchAllRows("profiles"),
      ]);
      return {
        applicants,
        job_postings: jobPostings,
        custom_questions: customQuestions,
        custom_answers: customAnswers,
        projects,
        profiles,
      };
    },
  });
}
