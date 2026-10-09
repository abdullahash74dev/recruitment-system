import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { ALLOW_ORIGIN } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Below this many new errors (and none marked critical) a run stays quiet
// and leaves the rows for the next run, so one flaky mobile connection
// doesn't page anyone, but a real outage does within ~15 minutes.
const MIN_ERRORS_TO_ALERT = Number(Deno.env.get("ERROR_ALERT_MIN_COUNT") || "5");
const LOOKBACK_HOURS = 24;
const MAX_ROWS = 1000;

type ErrorRow = {
  id: string;
  severity: string;
  source: string;
  message: string;
  url: string | null;
  user_email: string | null;
  created_at: string;
};

// Runs every 15 minutes (cron in 20261009010000_launch_hardening.sql).
// Sends one digest of not-yet-alerted error_log rows to every active admin
// (Resend) and to the optional Slack/Discord webhook in
// app_secrets.alert_webhook_url, then marks those rows alerted.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const cronSecret = req.headers.get("x-cron-secret") || "";
  const { data: secretRow } = await admin.from("app_secrets").select("value").eq("key", "cron_shared_secret").maybeSingle();
  if (!cronSecret || !secretRow?.value || cronSecret !== secretRow.value) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const since = new Date(Date.now() - LOOKBACK_HOURS * 3600_000).toISOString();
    const { data: rows, error } = await admin
      .from("error_log")
      .select("id, severity, source, message, url, user_email, created_at")
      .is("alerted_at", null)
      .gte("created_at", since)
      .in("severity", ["error", "critical"])
      .order("created_at", { ascending: true })
      .limit(MAX_ROWS);
    if (error) throw error;

    const errors = (rows || []) as ErrorRow[];
    const hasCritical = errors.some((e) => e.severity === "critical");
    if (errors.length === 0 || (errors.length < MIN_ERRORS_TO_ALERT && !hasCritical)) {
      return json({ ok: true, pending: errors.length, alerted: false });
    }

    const byMessage = new Map<string, { count: number; source: string; lastUrl: string | null }>();
    for (const e of errors) {
      const key = e.message.slice(0, 200);
      const entry = byMessage.get(key) || { count: 0, source: e.source, lastUrl: null };
      entry.count++;
      entry.lastUrl = e.url || entry.lastUrl;
      byMessage.set(key, entry);
    }
    const top = [...byMessage.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
    const affectedUsers = new Set(errors.map((e) => e.user_email).filter(Boolean)).size;

    const title = hasCritical
      ? `🚨 أخطاء حرجة في الموقع (${errors.length})`
      : `⚠️ ${errors.length} خطأ جديد في الموقع`;
    const lines = [
      title,
      `الفترة: ${new Date(errors[0].created_at).toLocaleString("ar-SA")} → ${new Date(errors[errors.length - 1].created_at).toLocaleString("ar-SA")}`,
      `مستخدمون مسجّلون متأثرون: ${affectedUsers} (زوار الصفحات العامة غير محسوبين)`,
      "",
      "الأخطاء الأكثر تكراراً:",
      ...top.map(([msg, info], i) => `${i + 1}. (${info.count}×, ${info.source}) ${msg}${info.lastUrl ? `\n   الصفحة: ${info.lastUrl}` : ""}`),
      "",
      "التفاصيل الكاملة: لوحة الإدارة ← سجل النظام / صحة النظام.",
    ];
    const text = lines.join("\n");

    const { data: adminRoles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    const adminIds = (adminRoles || []).map((r) => r.user_id);
    let recipients: string[] = [];
    if (adminIds.length > 0) {
      const { data: profiles } = await admin.from("profiles").select("email, is_active").in("user_id", adminIds);
      recipients = (profiles || []).filter((p) => p.is_active && p.email).map((p) => p.email as string);
    }

    let emailed = 0;
    for (const to of recipients) {
      const res = await sendEmail({ to, subject: title, text });
      if (res.ok) emailed++;
      else console.error("error-alerts: email failed", to, res.error);
    }

    let webhookSent = false;
    const { data: webhookRow } = await admin.from("app_secrets").select("value").eq("key", "alert_webhook_url").maybeSingle();
    if (webhookRow?.value) {
      try {
        const res = await fetch(webhookRow.value, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, content: text.slice(0, 1900) }),
        });
        webhookSent = res.ok;
      } catch (e) {
        console.error("error-alerts: webhook failed", e);
      }
    }

    // Advance the watermark even if delivery failed, so a broken mail
    // provider can't cause the same rows to be re-sent forever.
    const ids = errors.map((e) => e.id);
    const now = new Date().toISOString();
    for (let i = 0; i < ids.length; i += 200) {
      await admin.from("error_log").update({ alerted_at: now }).in("id", ids.slice(i, i + 200));
    }

    await admin.rpc("notify_admins", {
      _type: "system_errors",
      _title: title,
      _body: top.slice(0, 3).map(([msg, info]) => `${info.count}× ${msg}`).join(" • "),
      _link: "/dashboard",
      _severity: hasCritical ? "critical" : "warning",
      _metadata: { count: errors.length },
    });

    return json({ ok: true, alerted: true, count: errors.length, emailed, webhookSent });
  } catch (e) {
    console.error("error-alerts failed:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
