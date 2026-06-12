// AI System Doctor — analyzes recent system errors and suggests fixes.
// Runs on-demand (admin click) or automatically every 6 hours via pg_cron
// (authenticated via x-cron-secret / app_secrets.cron_shared_secret, same
// pattern as the scheduled-backup function). Every run is recorded in
// system_doctor_runs, and admins are notified when issues need attention.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Below this health score (or if any high/critical issue is found),
// admins are proactively notified.
const ALERT_HEALTH_SCORE = 70;

type DiagnosisResult = { parsed: any } | { error: string; status: number };

async function runDiagnosis(lang: string, clientErrors: any[], userId: string | null, userEmail: string | null): Promise<DiagnosisResult> {
  // Pull recent suspicious audit_log entries (failed logins, deletes, errors in summary)
  const { data: logs } = await admin.from("audit_log")
    .select("occurred_at, user_email, action, table_name, summary, new_data, old_data")
    .order("occurred_at", { ascending: false })
    .limit(200);

  const suspicious = (logs || []).filter((r: any) => {
    const s = (r.summary || "").toLowerCase();
    return r.action === "LOGIN_FAILED" || r.action === "DELETE" || s.includes("error") || s.includes("fail") || s.includes("خطأ") || s.includes("فشل");
  }).slice(0, 80);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey && !geminiKey) throw new Error("No AI key configured");

  const sys = lang === "ar"
    ? "أنت مهندس موثوقية أنظمة خبير. حلّل الأخطاء وقدّم تشخيصاً وحلولاً عملية واضحة. الرد JSON فقط."
    : "You are an expert site reliability engineer. Analyze errors and give clear, actionable fixes. Reply ONLY in JSON.";

  const userPrompt = lang === "ar"
    ? `حلّل بيانات النظام التالية وأعد JSON:
{
 "health_score": 0-100,
 "summary": "ملخص حالة النظام بجملتين",
 "issues": [{"title":"","severity":"low|medium|high|critical","root_cause":"","fix_steps":["خطوة 1","خطوة 2"],"auto_fixable":true|false}],
 "recommendations": ["توصيات وقائية"]
}

سجل النظام (آخر العمليات المشبوهة): ${JSON.stringify(suspicious)}
أخطاء الواجهة من المتصفح: ${JSON.stringify(clientErrors)}`
    : `Analyze and return JSON:
{
 "health_score": 0-100,
 "summary": "2-sentence system status",
 "issues": [{"title":"","severity":"low|medium|high|critical","root_cause":"","fix_steps":["step 1"],"auto_fixable":true|false}],
 "recommendations": ["preventive tips"]
}
Audit log: ${JSON.stringify(suspicious)}
Browser errors: ${JSON.stringify(clientErrors)}`;

  const aiResult = await callAI({
    service: "ai-system-doctor",
    model: "google/gemini-2.5-flash",
    userId,
    userEmail,
    body: {
      messages: [{ role: "system", content: sys }, { role: "user", content: userPrompt }],
      response_format: { type: "json_object" },
    },
  });

  if (!aiResult.ok) {
    if (aiResult.status === 429) return { error: "rate_limit", status: 429 };
    if (aiResult.status === 402) return { error: "credits_exhausted", status: 402 };
    throw new Error(`AI error: ${aiResult.errorText}`);
  }

  const content = aiResult.data?.choices?.[0]?.message?.content || "{}";
  let parsed: any;
  try { parsed = JSON.parse(content); } catch { parsed = { summary: content, issues: [], recommendations: [] }; }
  parsed.analyzed_count = suspicious.length;
  parsed.client_error_count = clientErrors.length;
  return { parsed };
}

function needsAlert(parsed: any): boolean {
  const score = typeof parsed.health_score === "number" ? parsed.health_score : 100;
  const hasSevere = Array.isArray(parsed.issues) && parsed.issues.some((i: any) => i.severity === "high" || i.severity === "critical");
  return score < ALERT_HEALTH_SCORE || hasSevere;
}

async function recordRun(parsed: any, triggeredBy: "cron" | "manual", triggeredByUser: string | null) {
  await admin.from("system_doctor_runs").insert({
    health_score: typeof parsed.health_score === "number" ? parsed.health_score : null,
    summary: parsed.summary || null,
    issues: parsed.issues || [],
    recommendations: parsed.recommendations || [],
    analyzed_count: parsed.analyzed_count || 0,
    client_error_count: parsed.client_error_count || 0,
    triggered_by: triggeredBy,
    triggered_by_user: triggeredByUser,
  });

  if (!needsAlert(parsed)) return;

  const score = typeof parsed.health_score === "number" ? parsed.health_score : null;
  const hasCritical = Array.isArray(parsed.issues) && parsed.issues.some((i: any) => i.severity === "critical");

  await admin.rpc("notify_admins", {
    _type: "system_doctor_alert",
    _title: hasCritical ? "طبيب النظام: تم رصد مشاكل حرجة" : "طبيب النظام: مشاكل تحتاج مراجعة",
    _body: parsed.summary || (score !== null ? `صحة النظام: ${score}/100` : ""),
    _link: "/admin?tab=ai_doctor",
    _severity: hasCritical || (score !== null && score < 50) ? "critical" : "warning",
    _metadata: { health_score: score, issue_count: (parsed.issues || []).length, triggered_by: triggeredBy },
  });
}

serve(async (req) => {
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

      const result = await runDiagnosis("ar", [], null, null);
      if ("error" in result) {
        return new Response(JSON.stringify(result), { status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await recordRun(result.parsed, "cron", null);
      return new Response(JSON.stringify({ ok: true, ...result.parsed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Manual trigger: caller must be an authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { lang = "ar", clientErrors = [] } = body;
    const result = await runDiagnosis(lang, clientErrors, u.user.id, u.user.email ?? null);
    if ("error" in result) {
      return new Response(JSON.stringify(result), { status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await recordRun(result.parsed, "manual", u.user.id);

    return new Response(JSON.stringify(result.parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-system-doctor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
