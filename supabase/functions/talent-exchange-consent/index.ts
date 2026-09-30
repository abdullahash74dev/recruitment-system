import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ALLOW_ORIGIN } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Public, token-gated -- the employee never logs in. "view" shows exactly
// what would become visible to other companies (never more) so they can
// make an informed decision; "decide" records it.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const { token, action } = body as { token?: string; action?: "view" | "decide"; decision?: "confirmed" | "declined" };

    if (!token || typeof token !== "string") return json({ error: "token is required" }, 400);

    const { data: listing, error } = await admin
      .from("talent_exchange_listings")
      .select("id, position_title, job_level, current_salary, current_work_location, release_reason_category, status, consent_status, consent_token_expires_at")
      .eq("consent_token", token)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!listing) return json({ error: "invalid_token" }, 404);

    const expired = listing.consent_token_expires_at && new Date(listing.consent_token_expires_at) <= new Date();
    if (expired && listing.status === "pending_consent") {
      await admin.from("talent_exchange_listings").update({ status: "expired" }).eq("id", listing.id);
      return json({ error: "expired_token" }, 410);
    }

    if (action === "decide") {
      const decision = (body as { decision?: string }).decision;
      if (listing.consent_status !== "pending") {
        return json({ error: "already_decided", consent_status: listing.consent_status }, 409);
      }
      if (decision !== "confirmed" && decision !== "declined") {
        return json({ error: "decision must be 'confirmed' or 'declined'" }, 400);
      }
      const { error: updateError } = await admin
        .from("talent_exchange_listings")
        .update({
          consent_status: decision,
          consent_confirmed_at: decision === "confirmed" ? new Date().toISOString() : null,
          status: decision === "confirmed" ? "active" : "withdrawn",
        })
        .eq("id", listing.id);
      if (updateError) return json({ error: updateError.message }, 500);
      return json({ success: true, consent_status: decision });
    }

    // Default: "view".
    return json({
      position_title: listing.position_title,
      job_level: listing.job_level,
      current_salary: listing.current_salary,
      current_work_location: listing.current_work_location,
      release_reason_category: listing.release_reason_category,
      consent_status: listing.consent_status,
      status: listing.status,
    });
  } catch (error) {
    console.error("talent-exchange-consent error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
