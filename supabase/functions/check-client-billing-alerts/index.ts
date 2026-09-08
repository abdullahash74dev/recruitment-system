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

const EXPIRY_WARNING_DAYS = 7;

// Runs daily (see the cron.schedule in 20260908080000_client_billing_alerts.sql).
// Two independent checks per active client org:
//   1. Low credits: credits_remaining <= low_credit_threshold. Edge-triggered
//      via low_credit_alert_active so it fires once per low-balance episode,
//      not once a day for as long as it stays low.
//   2. Expiry: expires_at within EXPIRY_WARNING_DAYS. Fires once per distinct
//      expires_at value (expiry_alerted_for), so renewing the subscription
//      (which changes expires_at) naturally re-arms it for next time.
// Both go to the org's contact (contact_email, or its active client_users as
// a fallback) and, cc-style, to every active admin so the internal team can
// proactively follow up on renewals/top-ups.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = req.headers.get("x-cron-secret") || "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: secretRow } = await admin.from("app_secrets").select("value").eq("key", "cron_shared_secret").maybeSingle();
  if (!cronSecret || !secretRow?.value || cronSecret !== secretRow.value) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const { data: orgs, error } = await admin
      .from("client_organizations")
      .select(
        "id, name, contact_email, credits_remaining, low_credit_threshold, low_credit_alert_active, expires_at, expiry_alerted_for"
      )
      .eq("subscription_status", "active");
    if (error) throw error;

    const { data: adminRoles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    const adminUserIds = (adminRoles || []).map((r) => r.user_id);
    let adminEmails: string[] = [];
    if (adminUserIds.length > 0) {
      const { data: adminProfiles } = await admin
        .from("profiles")
        .select("email, is_active")
        .in("user_id", adminUserIds);
      adminEmails = (adminProfiles || [])
        .filter((p) => p.is_active && p.email)
        .map((p) => p.email as string);
    }

    const now = new Date();
    let lowCreditAlerts = 0;
    let expiryAlerts = 0;

    for (const org of orgs || []) {
      const recipients: string[] = [];
      if (org.contact_email) recipients.push(org.contact_email);
      if (recipients.length === 0) {
        const { data: users } = await admin
          .from("client_users")
          .select("email")
          .eq("client_organization_id", org.id)
          .eq("is_active", true);
        for (const u of users || []) if (u.email) recipients.push(u.email);
      }

      const notify = async (subject: string, text: string) => {
        for (const to of recipients) {
          const result = await sendEmail({ to, subject, text });
          if (!result.ok) console.error(`Billing alert to ${to} failed:`, result.error);
        }
        for (const to of adminEmails) {
          const result = await sendEmail({ to, subject: `[إداري] ${subject}`, text: `${text}\n\nمعرّف المنظمة: ${org.id}` });
          if (!result.ok) console.error(`Admin billing alert to ${to} failed:`, result.error);
        }
      };

      // 1) Low credits.
      const isLow = org.credits_remaining <= org.low_credit_threshold;
      if (isLow && !org.low_credit_alert_active) {
        await notify(
          `تنبيه: رصيد ${org.name} منخفض`,
          `رصيد شركة "${org.name}" وصل إلى ${org.credits_remaining} رصيد فقط (الحد المحدد للتنبيه: ${org.low_credit_threshold}).\n\n` +
            `يرجى تجديد الرصيد لتفادي توقف إمكانية كشف بيانات مرشحين جدد.`
        );
        await admin.from("client_organizations").update({ low_credit_alert_active: true }).eq("id", org.id);
        lowCreditAlerts += 1;
      } else if (!isLow && org.low_credit_alert_active) {
        // Topped back up -- rearm so the next drop below the threshold alerts again.
        await admin.from("client_organizations").update({ low_credit_alert_active: false }).eq("id", org.id);
      }

      // 2) Subscription expiring soon.
      if (org.expires_at) {
        const expiresAt = new Date(org.expires_at);
        const daysLeft = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        const alreadyAlertedForThisExpiry = org.expiry_alerted_for === org.expires_at;
        if (daysLeft > 0 && daysLeft <= EXPIRY_WARNING_DAYS && !alreadyAlertedForThisExpiry) {
          const daysLeftRounded = Math.max(1, Math.ceil(daysLeft));
          await notify(
            `تذكير: اشتراك ${org.name} ينتهي قريباً`,
            `اشتراك شركة "${org.name}" سينتهي خلال ${daysLeftRounded} يوم (بتاريخ ${expiresAt.toLocaleDateString("ar-SA")}).\n\n` +
              `يرجى التجديد لتفادي انقطاع الوصول لبوابة العملاء.`
          );
          await admin.from("client_organizations").update({ expiry_alerted_for: org.expires_at }).eq("id", org.id);
          expiryAlerts += 1;
        }
      }
    }

    return json({ ok: true, checked: (orgs || []).length, lowCreditAlerts, expiryAlerts });
  } catch (err) {
    console.error("check-client-billing-alerts failed:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
