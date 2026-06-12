// Scheduled system backup: snapshots core data tables to JSON and stores
// them in the private "backups" bucket. Triggered nightly by pg_cron
// (authenticated via x-cron-secret / app_secrets.cron_shared_secret) or
// manually by an admin from the dashboard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey);

const BACKUP_TABLES = [
  "applicants",
  "applicant_emails",
  "job_postings",
  "job_advertisements",
  "job_categories",
  "job_title_categories",
  "custom_questions",
  "custom_answers",
  "dropdown_options",
  "form_field_config",
  "rejection_reasons",
  "value_synonyms",
  "projects",
  "profiles",
  "user_roles",
  "user_permissions",
  "recruitment_candidates",
  "recruitment_projects",
  "recruitment_job_titles",
  "recruitment_import_batches",
  "site_settings",
  "scheduled_reports",
  "report_templates",
];

const RETENTION_DAYS = 30;
const BACKUP_FOLDER = "auto";

async function runBackup(triggeredBy: "cron" | "manual", triggeredByUser: string | null) {
  const snapshot: Record<string, unknown> = { exported_at: new Date().toISOString() };
  const summary: Record<string, number> = {};

  for (const table of BACKUP_TABLES) {
    const { data, error } = await admin.from(table).select("*");
    if (error) throw new Error(`${table}: ${error.message}`);
    snapshot[table] = data || [];
    summary[table] = data?.length || 0;
  }

  const json = JSON.stringify(snapshot, null, 2);
  const bytes = new TextEncoder().encode(json);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `backup-${ts}.json`;
  const filePath = `${BACKUP_FOLDER}/${fileName}`;

  const { error: upErr } = await admin.storage.from("backups").upload(filePath, bytes, {
    contentType: "application/json",
    upsert: true,
  });
  if (upErr) throw upErr;

  await admin.from("backup_runs").insert({
    status: "success",
    file_path: filePath,
    file_size: bytes.byteLength,
    tables_summary: summary,
    triggered_by: triggeredBy,
    triggered_by_user: triggeredByUser,
  });

  // Retention: remove backup files older than RETENTION_DAYS
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const { data: files } = await admin.storage.from("backups").list(BACKUP_FOLDER, { limit: 1000 });
  const stale = (files || [])
    .filter((f) => f.created_at && new Date(f.created_at).getTime() < cutoff)
    .map((f) => `${BACKUP_FOLDER}/${f.name}`);
  if (stale.length) await admin.storage.from("backups").remove(stale);

  await admin.rpc("notify_admins", {
    _type: "backup_complete",
    _title: "تمت النسخة الاحتياطية للنظام بنجاح",
    _body: `${fileName} • ${(bytes.byteLength / 1024).toFixed(1)} KB`,
    _link: "/admin?tab=backup",
    _severity: "success",
    _metadata: { file_path: filePath, summary },
  });

  return { file_path: filePath, file_size: bytes.byteLength, summary };
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

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
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
