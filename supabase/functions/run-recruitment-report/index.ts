// Custom report builder: builds Excel from a config { scope, fields, filters, group_by, ai_insights }
// Modes:
//   - body { template_id }  → fetch report_templates.config
//   - body { config }       → ad-hoc
//   - body { cron: true }   → cron loop over scheduled_reports
// Always normalizes bilingual values via value_synonyms; lang preference from caller or 'ar'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { loadSynonymMap, normalizeValue, Lang } from "../_shared/normalize.ts";
import { callAI } from "../_shared/ai-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey);

const SCOPE_TABLES: Record<string, string> = {
  applicants: "applicants",
  recruitment: "recruitment_candidates",
  jobs: "job_postings",
};

// Fields per scope that should be normalized via synonyms
const NORMALIZABLE_FIELDS: Record<string, string> = {
  // applicants
  education_level: "education_level",
  nationality: "nationality",
  current_city: "city",
  preferred_city: "city",
  desired_position: "desired_position",
  major: "major",
  // recruitment_candidates
  // jobs
  location: "city",
  department: "department",
  job_type: "job_type",
};

interface ReportConfig {
  scope: "applicants" | "recruitment" | "jobs";
  fields: string[];                 // columns to include in detail sheet
  filters?: Record<string, any>;    // simple eq filters
  group_by?: string[];              // one or two fields to pivot
  ai_insights?: boolean;
  lang?: Lang;                      // ar | en (defaults ar)
  format?: "excel";                 // pdf later
  name?: string;
}

async function fetchData(scope: string, filters: Record<string, any> = {}) {
  const table = SCOPE_TABLES[scope] || "applicants";
  let q = admin.from(table).select("*");
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined || v === "") continue;
    q = q.eq(k, v);
  }
  const { data, error } = await q.limit(10000);
  if (error) throw error;
  return data || [];
}

function applyNormalization(rows: any[], lang: Lang, synMap: Map<string, { ar: string; en: string }>) {
  return rows.map(r => {
    const out: any = { ...r };
    for (const [col, field] of Object.entries(NORMALIZABLE_FIELDS)) {
      if (out[col] !== undefined && out[col] !== null && out[col] !== "") {
        out[col] = normalizeValue(synMap, field, out[col], lang);
      }
    }
    return out;
  });
}

function groupAndCount(rows: any[], by: string[]): any[][] {
  if (by.length === 0) return [];
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = by.map(b => String(r[b] ?? "—")).join(" ║ ");
    map.set(key, (map.get(key) || 0) + 1);
  }
  const header = [...by, "العدد"];
  const body = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => [...k.split(" ║ "), v]);
  return [header, ...body];
}

async function aiInsights(scope: string, rows: any[], groupedAgg: any[][]): Promise<string> {
  try {
    const sample = rows.slice(0, 50);
    const aggPreview = groupedAgg.slice(0, 30);
    const ai = await callAI({
      service: "ai-report-insights",
      model: "google/gemini-2.5-flash",
      body: {
        messages: [
          { role: "system", content: "أنت محلل بيانات توظيف. اكتب ملخصاً تنفيذياً عربياً (5-10 أسطر) ثم توصيات قابلة للتنفيذ بناءً على البيانات." },
          { role: "user", content: `نطاق التقرير: ${scope}\nعدد السجلات: ${rows.length}\n\nملخص التجميع:\n${JSON.stringify(aggPreview)}\n\nعينة بيانات (50 سجل):\n${JSON.stringify(sample)}` },
        ],
      },
    });
    if (ai.ok) {
      return ai.data?.choices?.[0]?.message?.content || "";
    }
  } catch (e) { console.error("insights error:", e); }
  return "";
}

async function buildReport(cfg: ReportConfig, triggeredBy: string | null, scheduledReportId: string | null = null, templateId: string | null = null) {
  const lang: Lang = cfg.lang || "ar";
  const synMap = await loadSynonymMap(url, serviceKey);

  const rawRows = await fetchData(cfg.scope, cfg.filters || {});
  const rows = applyNormalization(rawRows, lang, synMap);

  // Detail sheet
  const fields = cfg.fields && cfg.fields.length ? cfg.fields : Object.keys(rows[0] || {});
  const detail = [fields, ...rows.map(r => fields.map(f => r[f] ?? ""))];

  // Summary stats
  const summary: any[][] = [["مؤشر", "القيمة"], ["إجمالي السجلات", rows.length], ["نطاق التقرير", cfg.scope], ["لغة العرض", lang]];

  // Group-by sheet
  const grouped = cfg.group_by && cfg.group_by.length ? groupAndCount(rows, cfg.group_by) : [];

  // AI insights
  let insights = "";
  if (cfg.ai_insights) insights = await aiInsights(cfg.scope, rows, grouped);

  // Build workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "الملخص");
  if (grouped.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(grouped), "التجميع");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detail), "التفاصيل");
  if (insights) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["تحليل الذكاء الاصطناعي"], ...insights.split("\n").map(l => [l])]), "تحليل AI");
  }

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const asciiName = (cfg.name || "custom-report").replace(/[^\w-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
  const safeName = asciiName || "report";
  const fileName = `${safeName}-${ts}.xlsx`;
  const folder = triggeredBy || "system";
  const filePath = `${folder}/${fileName}`;

  const { error: upErr } = await admin.storage.from("reports").upload(filePath, new Uint8Array(buf), {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });
  if (upErr) throw upErr;
  const { data: signed } = await admin.storage.from("reports").createSignedUrl(filePath, 60 * 60 * 24 * 7);
  const fileUrl = signed?.signedUrl || null;

  await admin.from("report_runs").insert({
    scheduled_report_id: scheduledReportId,
    template_id: templateId,
    status: "success",
    file_url: fileUrl,
    file_name: fileName,
    triggered_by: triggeredBy,
    insights_summary: insights || null,
  });

  return { file_url: fileUrl, file_name: fileName, insights, row_count: rows.length };
}

function nextRunFromFrequency(freq: string): Date {
  const d = new Date();
  if (freq === "daily") d.setDate(d.getDate() + 1);
  else if (freq === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + 7);
  return d;
}

const DEFAULT_CFG: ReportConfig = {
  scope: "recruitment",
  fields: ["full_name","nationality","status","hire_date","created_at"],
  group_by: ["status"],
  ai_insights: false,
  lang: "ar",
  name: "recruitment-summary",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const isCron = body.cron === true;
    const authHeader = req.headers.get("Authorization") || "";

    if (isCron) {
      const cronSecret = req.headers.get("x-cron-secret") || "";
      const { data: secretRow } = await admin.from("app_secrets").select("value").eq("key", "cron_shared_secret").maybeSingle();
      if (!cronSecret || !secretRow?.value || cronSecret !== secretRow.value) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: due } = await admin
        .from("scheduled_reports")
        .select("id, name, frequency, recipient_user_ids, created_by, next_run_at, template_id")
        .eq("is_active", true)
        .or(`next_run_at.is.null,next_run_at.lte.${new Date().toISOString()}`);

      const results: any[] = [];
      for (const sr of due || []) {
        try {
          let cfg: ReportConfig = { ...DEFAULT_CFG, name: sr.name };
          if (sr.template_id) {
            const { data: tpl } = await admin.from("report_templates").select("config").eq("id", sr.template_id).maybeSingle();
            if (tpl?.config) cfg = { ...DEFAULT_CFG, ...tpl.config, name: sr.name };
          }
          const recipients: string[] = sr.recipient_user_ids?.length ? sr.recipient_user_ids : (sr.created_by ? [sr.created_by] : []);
          const r = await buildReport(cfg, sr.created_by || null, sr.id, sr.template_id || null);
          for (const uid of recipients) {
            await admin.from("notifications").insert({
              user_id: uid, type: "report_ready",
              title: `التقرير الدوري جاهز: ${sr.name}`,
              body: r.file_name, link: r.file_url, severity: "success",
              metadata: { file_url: r.file_url, scheduled_report_id: sr.id },
            });
          }
          await admin.from("scheduled_reports").update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRunFromFrequency(sr.frequency).toISOString(),
          }).eq("id", sr.id);
          results.push({ id: sr.id, ...r });
        } catch (e) {
          await admin.from("report_runs").insert({
            scheduled_report_id: sr.id, status: "failed",
            error_message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User-triggered
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let cfg: ReportConfig = { ...DEFAULT_CFG };
    let templateId: string | null = null;
    if (body.template_id) {
      const { data: tpl } = await admin.from("report_templates").select("name, config").eq("id", body.template_id).maybeSingle();
      if (tpl?.config) {
        cfg = { ...DEFAULT_CFG, ...tpl.config, name: tpl.name };
        templateId = body.template_id;
      }
    } else if (body.config) {
      cfg = { ...DEFAULT_CFG, ...body.config };
    }
    const r = await buildReport(cfg, user.id, body.scheduled_report_id || null, templateId);

    // Notify the requester
    await admin.from("notifications").insert({
      user_id: user.id, type: "report_ready",
      title: `التقرير جاهز: ${cfg.name}`,
      body: r.file_name, link: r.file_url, severity: "success",
      metadata: { file_url: r.file_url },
    });

    return new Response(JSON.stringify({ ok: true, ...r }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("run-recruitment-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
