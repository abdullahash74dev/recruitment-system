import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { ALLOW_ORIGIN } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";
import {
  type Filter,
  type SynonymRow,
  expandCanonicalFilters,
  applyFieldFilters,
  applySearch,
} from "../_shared/clientApplicantFilters.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_MATCHES_PER_EMAIL = 10;

// Runs hourly (see the cron.schedule in 20260908070000_client_saved_filter_alerts.sql).
// For every alert-enabled client_saved_filters row: re-runs that exact
// filter (via the same shared query builder client-search-applicants uses,
// so matching never drifts between what a client sees live and what
// triggers an alert) restricted to applicants created since the filter's
// last check, and emails the filter's creator when there's at least one
// new match. The watermark (last_alerted_at) always advances after a run,
// even if the email itself fails, so a persistent send failure can't cause
// the same matches to be re-scanned (and potentially re-sent once the
// provider recovers) forever -- failures are logged for visibility instead.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = req.headers.get("x-cron-secret") || "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: secretRow } = await admin.from("app_secrets").select("value").eq("key", "cron_shared_secret").maybeSingle();
  if (!cronSecret || !secretRow?.value || cronSecret !== secretRow.value) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const { data: filters, error: filtersError } = await admin
      .from("client_saved_filters")
      .select("id, client_organization_id, created_by, name, filters, search, search_mode, last_alerted_at, created_at")
      .eq("alert_enabled", true);
    if (filtersError) throw filtersError;

    if (!filters || filters.length === 0) {
      return json({ ok: true, checked: 0, alerted: 0 });
    }

    const { data: synonymRows } = await admin
      .from("value_synonyms")
      .select("field_name, canonical_ar, canonical_en, synonyms");

    // Skip orgs whose subscription has lapsed -- same access gate
    // client-search-applicants enforces for interactive searches, so an
    // expired org's team stops getting alerts the moment they'd also lose
    // portal access, and starts again the moment they're renewed.
    const orgIds = [...new Set(filters.map((f) => f.client_organization_id))];
    const { data: orgs } = await admin
      .from("client_organizations")
      .select("id, subscription_status, expires_at")
      .in("id", orgIds);
    const now = new Date();
    const activeOrgIds = new Set(
      (orgs || [])
        .filter((o) => o.subscription_status === "active" && (!o.expires_at || new Date(o.expires_at) > now))
        .map((o) => o.id)
    );

    let alerted = 0;
    const nowIso = now.toISOString();

    for (const filter of filters) {
      if (!activeOrgIds.has(filter.client_organization_id)) continue;
      try {
        const since = filter.last_alerted_at || filter.created_at;
        const expanded = expandCanonicalFilters((filter.filters || []) as Filter[], (synonymRows || []) as SynonymRow[]);

        let dataQuery = admin
          .from("applicants")
          .select("id, full_name, desired_position, current_city, preferred_city, created_at")
          .gt("created_at", since);
        dataQuery = applyFieldFilters(dataQuery, expanded);
        dataQuery = applySearch(dataQuery, filter.search, filter.search_mode);
        dataQuery = dataQuery.order("created_at", { ascending: false }).limit(MAX_MATCHES_PER_EMAIL);

        const { data: matches, error: matchError } = await dataQuery;
        if (matchError) {
          console.error(`Filter ${filter.id} query failed:`, matchError.message);
          continue;
        }

        if (matches && matches.length > 0) {
          const { data: clientUser } = await admin
            .from("client_users")
            .select("email")
            .eq("user_id", filter.created_by)
            .maybeSingle();

          if (clientUser?.email) {
            const lines = matches
              .map((m: { full_name: string; desired_position: string | null; current_city: string | null; preferred_city: string | null }) =>
                `- ${m.full_name} — ${m.desired_position || "—"} (${m.current_city || m.preferred_city || "—"})`
              )
              .join("\n");
            const subject = `مرشحون جدد يطابقون فلترك "${filter.name}"`;
            const text =
              `مرحباً،\n\n` +
              `ظهر ${matches.length} مرشح جديد يطابق الفلتر المحفوظ "${filter.name}":\n\n${lines}\n\n` +
              `افتح بوابة العملاء لمراجعتهم وكشف بياناتهم.\n\nمع التحية`;

            const result = await sendEmail({ to: clientUser.email, subject, text });
            if (result.ok) {
              alerted += 1;
            } else {
              console.error(`Alert email failed for filter ${filter.id}:`, result.error);
            }
          }
        }

        await admin.from("client_saved_filters").update({ last_alerted_at: nowIso }).eq("id", filter.id);
      } catch (perFilterError) {
        console.error(`Failed processing filter ${filter.id}:`, perFilterError);
      }
    }

    return json({ ok: true, checked: filters.length, alerted });
  } catch (error) {
    console.error("check-saved-filter-alerts failed:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
