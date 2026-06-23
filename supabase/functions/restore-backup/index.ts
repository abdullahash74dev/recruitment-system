// Restores the system from a snapshot produced by scheduled-backup: the
// data.json (every table) and, optionally, every file copied alongside it
// (resumes, applicant attachments, ...). Admin-only, requires a typed
// confirmation, and - before any destructive "replace" restore - takes a
// fresh safety backup of the CURRENT state first, so a bad restore is
// itself always recoverable.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey);

const CONFIRM_TOKEN = "RESTORE";

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function listAllObjects(bucket: string, prefix = ""): Promise<string[]> {
  const LIMIT = 1000;
  const paths: string[] = [];
  for (let offset = 0; ; offset += LIMIT) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: LIMIT, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        paths.push(...(await listAllObjects(bucket, fullPath)));
      } else {
        paths.push(fullPath);
      }
    }
    if (data.length < LIMIT) break;
  }
  return paths;
}

// Triggers a full backup of the CURRENT state (DB + files) via the
// scheduled-backup function, using the same shared secret pg_cron uses, so a
// destructive restore is always preceded by an up-to-the-second checkpoint
// that can itself be restored from if the restore turns out to be wrong.
async function takeSafetyBackup(): Promise<string> {
  const { data: secretRow, error: secretErr } = await admin.from("app_secrets").select("value").eq("key", "cron_shared_secret").maybeSingle();
  if (secretErr || !secretRow?.value) throw new Error("Could not load cron secret for safety backup");

  const res = await fetch(`${url}/functions/v1/scheduled-backup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": secretRow.value },
    body: JSON.stringify({ cron: true }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`Pre-restore safety backup failed: ${json.error || res.statusText}`);
  return json.backup_folder as string;
}

async function restoreFiles(backupFolder: string, mode: "merge" | "replace"): Promise<number> {
  const filesRoot = `${backupFolder}/files`;
  const { data: bucketEntries } = await admin.storage.from("backups").list(filesRoot, { limit: 1000 });
  const buckets = (bucketEntries || []).filter((e) => e.id === null).map((e) => e.name);

  let restored = 0;
  for (const bucket of buckets) {
    const snapshotPaths = await listAllObjects("backups", `${filesRoot}/${bucket}`);
    const relativePaths = snapshotPaths.map((p) => p.slice(`${filesRoot}/${bucket}/`.length));

    await mapWithConcurrency(relativePaths, 10, async (relPath) => {
      const { error } = await admin.storage.from("backups").copy(`${filesRoot}/${bucket}/${relPath}`, relPath, { destinationBucket: bucket });
      if (!error) restored++;
      else console.error(`restore-backup: failed to restore ${bucket}/${relPath}`, error);
    });

    if (mode === "replace") {
      const currentPaths = await listAllObjects(bucket);
      const snapshotSet = new Set(relativePaths);
      const extra = currentPaths.filter((p) => !snapshotSet.has(p));
      if (extra.length) await admin.storage.from(bucket).remove(extra);
    }
  }
  return restored;
}

async function runRestore(opts: {
  backupFolder: string;
  mode: "merge" | "replace";
  tables: string[] | null;
  includeFiles: boolean;
  triggeredByUser: string;
}) {
  const { backupFolder, mode, tables, includeFiles, triggeredByUser } = opts;

  const { data: dataBlob, error: dlErr } = await admin.storage.from("backups").download(`${backupFolder}/data.json`);
  if (dlErr || !dataBlob) throw new Error(`Could not load backup snapshot at ${backupFolder}: ${dlErr?.message || "not found"}`);

  const snapshot = JSON.parse(await dataBlob.text());
  delete snapshot.exported_at;

  const tableNames = tables && tables.length > 0 ? tables.filter((t) => t in snapshot) : Object.keys(snapshot);
  const tablesPayload: Record<string, unknown> = {};
  for (const t of tableNames) tablesPayload[t] = snapshot[t];

  let preRestoreSafetyBackupPath: string | null = null;
  if (mode === "replace") {
    preRestoreSafetyBackupPath = await takeSafetyBackup();
  }

  const { data: tablesRestored, error: rpcErr } = await admin.rpc("restore_from_backup", {
    _tables: tablesPayload,
    _mode: mode,
  });
  if (rpcErr) throw new Error(`restore_from_backup: ${rpcErr.message}`);

  const filesRestored = includeFiles ? await restoreFiles(backupFolder, mode) : 0;

  await admin.from("restore_runs").insert({
    status: "success",
    source_backup_path: backupFolder,
    mode,
    tables_restored: tablesRestored,
    files_restored: filesRestored,
    pre_restore_safety_backup_path: preRestoreSafetyBackupPath,
    triggered_by_user: triggeredByUser,
  });

  await admin.rpc("notify_admins", {
    _type: "restore_complete",
    _title: "تم استرداد بيانات النظام",
    _body: `${Object.keys(tablesRestored || {}).length} جدول • ${filesRestored} ملف • نمط: ${mode === "replace" ? "استبدال كامل" : "دمج آمن"}`,
    _link: "/admin?tab=backup",
    _severity: mode === "replace" ? "warning" : "success",
    _metadata: { backup_folder: backupFolder, mode, tablesRestored, filesRestored, preRestoreSafetyBackupPath },
  });

  return { tablesRestored, filesRestored, preRestoreSafetyBackupPath };
}

async function recordFailure(triggeredByUser: string | null, mode: string, backupFolder: string, message: string) {
  try {
    await admin.from("restore_runs").insert({
      status: "failed",
      source_backup_path: backupFolder,
      mode,
      error_message: message,
      triggered_by_user: triggeredByUser,
    });
    await admin.rpc("notify_admins", {
      _type: "restore_failed",
      _title: "فشلت عملية استرداد البيانات",
      _body: message,
      _link: "/admin?tab=backup",
      _severity: "critical",
      _metadata: { backup_folder: backupFolder },
    });
  } catch (e) {
    console.error("restore-backup: failed to record failure", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const body = await req.json().catch(() => ({}));

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });

  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });

  const { data: isAdmin, error: roleError } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (roleError) return new Response(JSON.stringify({ error: "Role check failed", details: roleError.message }), { status: 500, headers: jsonHeaders });
  if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: jsonHeaders });

  const backupFolder: string = body.backup_folder;
  const mode: string = body.mode;
  const tables: string[] | null = Array.isArray(body.tables) && body.tables.length > 0 ? body.tables : null;
  const includeFiles: boolean = body.includeFiles !== false;
  const confirm: string = body.confirm;

  if (!backupFolder) return new Response(JSON.stringify({ error: "backup_folder is required" }), { status: 400, headers: jsonHeaders });
  if (mode !== "merge" && mode !== "replace") return new Response(JSON.stringify({ error: "mode must be 'merge' or 'replace'" }), { status: 400, headers: jsonHeaders });
  if (confirm !== CONFIRM_TOKEN) return new Response(JSON.stringify({ error: `Type "${CONFIRM_TOKEN}" to confirm this operation` }), { status: 400, headers: jsonHeaders });

  try {
    const result = await runRestore({ backupFolder, mode, tables, includeFiles, triggeredByUser: user.id });
    return new Response(JSON.stringify({ ok: true, ...result }), { headers: jsonHeaders });
  } catch (e) {
    console.error("restore-backup error:", e);
    const message = e instanceof Error ? e.message : String(e);
    await recordFailure(user.id, mode, backupFolder, message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
  }
});
