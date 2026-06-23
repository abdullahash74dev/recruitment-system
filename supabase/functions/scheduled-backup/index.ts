// Scheduled system backup: snapshots every table in the public schema to
// JSON and copies every file in every source-data storage bucket (resumes,
// applicant attachments, etc.), all into one dated folder in the private
// "backups" bucket. Triggered nightly by pg_cron (authenticated via
// x-cron-secret / app_secrets.cron_shared_secret) or manually by an admin
// from the dashboard. Restored via the restore-backup function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey);

const RETENTION_DAYS = 30;
const BACKUP_FOLDER = "auto";

// Buckets that hold generated/transient artifacts rather than irreplaceable
// source data. Backing these up would be wasteful (the "backups" bucket
// backing up itself every run) or pointless (regenerable reports, in-flight
// import drafts), so they're excluded from the file-backup step.
const EXCLUDED_BUCKETS = new Set(["backups", "reports", "import-drafts"]);

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

// Fetch every row of a table (paginated): a flat .select("*") is silently
// capped at the platform's default row limit, which would make a backup
// report "success" while only capturing a fraction of large tables like
// applicants (up to ~67k rows).
async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
  const PAGE_SIZE = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin.from(table).select("*").range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

// Recursively list every object path in a bucket (storage .list() only
// returns one folder level per call; sub-folders come back as entries with
// id === null and must be walked individually).
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

async function backupFiles(runFolder: string): Promise<Record<string, { count: number; failed: number }>> {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);

  const sourceBuckets = (buckets || []).map((b) => b.id || b.name).filter((id) => !EXCLUDED_BUCKETS.has(id));
  const summary: Record<string, { count: number; failed: number }> = {};

  for (const bucket of sourceBuckets) {
    const paths = await listAllObjects(bucket);
    let failed = 0;
    await mapWithConcurrency(paths, 10, async (path) => {
      const dest = `${runFolder}/files/${bucket}/${path}`;
      const { error: copyErr } = await admin.storage.from(bucket).copy(path, dest, { destinationBucket: "backups" });
      if (copyErr) {
        failed++;
        console.error(`scheduled-backup: failed to copy ${bucket}/${path}`, copyErr);
      }
    });
    summary[bucket] = { count: paths.length - failed, failed };
  }

  return summary;
}

async function runBackup(triggeredBy: "cron" | "manual", triggeredByUser: string | null) {
  const { data: tables, error: tablesErr } = await admin.rpc("get_backup_table_names");
  if (tablesErr) throw new Error(`get_backup_table_names: ${tablesErr.message}`);
  const backupTables: string[] = tables || [];

  const snapshot: Record<string, unknown> = { exported_at: new Date().toISOString() };
  const summary: Record<string, number> = {};

  const tableRows = await Promise.all(backupTables.map((table) => fetchAllRows(table)));
  backupTables.forEach((table, i) => {
    snapshot[table] = tableRows[i];
    summary[table] = tableRows[i].length;
  });

  // Integrity check: a fresh head-count per table must match what we just
  // fetched. A mismatch means rows changed mid-export or - the exact bug
  // this guards against - a platform row cap silently truncated a fetch.
  const counts = await Promise.all(
    backupTables.map((table) => admin.from(table).select("*", { count: "exact", head: true }))
  );
  const integrityIssues = backupTables.filter((table, i) => (counts[i].count ?? -1) !== summary[table]);
  const integrityOk = integrityIssues.length === 0;

  const runFolder = `${BACKUP_FOLDER}/${Date.now()}`;
  const dataPath = `${runFolder}/data.json`;

  const json = JSON.stringify(snapshot, null, 2);
  const bytes = new TextEncoder().encode(json);

  const { error: upErr } = await admin.storage.from("backups").upload(dataPath, bytes, {
    contentType: "application/json",
    upsert: true,
  });
  if (upErr) throw upErr;

  const bucketsSummary = await backupFiles(runFolder);
  const totalFiles = Object.values(bucketsSummary).reduce((sum, b) => sum + b.count, 0);
  const totalFailed = Object.values(bucketsSummary).reduce((sum, b) => sum + b.failed, 0);

  await admin.from("backup_runs").insert({
    status: integrityOk && totalFailed === 0 ? "success" : "warning",
    file_path: dataPath,
    file_size: bytes.byteLength,
    backup_folder: runFolder,
    tables_summary: summary,
    buckets_summary: bucketsSummary,
    integrity_ok: integrityOk,
    triggered_by: triggeredBy,
    triggered_by_user: triggeredByUser,
    error_message: integrityOk ? null : `Row count mismatch in: ${integrityIssues.join(", ")}`,
  });

  await cleanupOldBackups();

  await admin.rpc("notify_admins", {
    _type: integrityOk && totalFailed === 0 ? "backup_complete" : "backup_warning",
    _title: integrityOk && totalFailed === 0
      ? "تمت النسخة الاحتياطية للنظام بنجاح"
      : "تمت النسخة الاحتياطية مع تحذيرات",
    _body: `${backupTables.length} جدول • ${totalFiles} ملف${totalFailed ? ` • فشل نسخ ${totalFailed} ملف` : ""}${!integrityOk ? ` • تعارض في: ${integrityIssues.join(", ")}` : ""}`,
    _link: "/admin?tab=backup",
    _severity: integrityOk && totalFailed === 0 ? "success" : "warning",
    _metadata: { backup_folder: runFolder, summary, bucketsSummary },
  });

  return { file_path: dataPath, backup_folder: runFolder, file_size: bytes.byteLength, summary, bucketsSummary, integrityOk };
}

// Retention: remove whole run folders (data.json + copied files) older than
// RETENTION_DAYS. The run timestamp is the folder name itself (epoch ms),
// so age is read directly from the name instead of per-object metadata.
async function cleanupOldBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const { data: entries } = await admin.storage.from("backups").list(BACKUP_FOLDER, { limit: 1000 });
  const staleFolders = (entries || [])
    .filter((e) => e.id === null && /^\d+$/.test(e.name) && Number(e.name) < cutoff)
    .map((e) => `${BACKUP_FOLDER}/${e.name}`);

  for (const folder of staleFolders) {
    const paths = await listAllObjects("backups", folder);
    if (paths.length) await admin.storage.from("backups").remove(paths);
  }
}

async function recordFailure(triggeredBy: "cron" | "manual", triggeredByUser: string | null, message: string) {
  try {
    await admin.from("backup_runs").insert({
      status: "failed",
      error_message: message,
      triggered_by: triggeredBy,
      triggered_by_user: triggeredByUser,
    });
    await admin.rpc("notify_admins", {
      _type: "backup_failed",
      _title: "فشلت عملية النسخ الاحتياطي",
      _body: message,
      _link: "/admin?tab=backup",
      _severity: "critical",
      _metadata: {},
    });
  } catch (e) {
    console.error("scheduled-backup: failed to record failure", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const isCron = body.cron === true;

  try {
    if (isCron) {
      const cronSecret = req.headers.get("x-cron-secret") || "";
      const { data: secretRow } = await admin.from("app_secrets").select("value").eq("key", "cron_shared_secret").maybeSingle();
      if (!cronSecret || !secretRow?.value || cronSecret !== secretRow.value) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const result = await runBackup("cron", null);
      return new Response(JSON.stringify({ ok: true, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Manual trigger: caller must be an authenticated admin
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: isAdmin, error: roleError } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (roleError) {
      console.error("has_role check failed:", roleError);
      return new Response(JSON.stringify({ error: "Role check failed", details: roleError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const result = await runBackup("manual", user.id);
    return new Response(JSON.stringify({ ok: true, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("scheduled-backup error:", e);
    const message = e instanceof Error ? e.message : String(e);
    await recordFailure(isCron ? "cron" : "manual", null, message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
