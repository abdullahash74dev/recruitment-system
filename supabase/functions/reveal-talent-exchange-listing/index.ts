import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ALLOW_ORIGIN } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Same atomic, race-safe credit deduction as reveal-candidate -- one credit
// from the same wallet unlocks the employee's real identity + contact info
// for this listing. A second reveal of the same listing by the same org is
// a free re-fetch, never charged twice.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const callerUserId = claimsData.claims.sub;

    const { data: clientUser } = await admin
      .from("client_users")
      .select("client_organization_id, is_active")
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (!clientUser?.is_active) return json({ error: "Not an active client user" }, 403);
    const clientOrganizationId = clientUser.client_organization_id;

    const { data: org, error: orgError } = await admin
      .from("client_organizations")
      .select("id, name, subscription_status, expires_at, credits_remaining")
      .eq("id", clientOrganizationId)
      .maybeSingle();
    if (orgError || !org) return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    const isExpired = !!org.expires_at && new Date(org.expires_at) <= new Date();
    if (org.subscription_status !== "active" || isExpired) {
      return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    }

    const { listingId } = await req.json();
    if (!listingId || typeof listingId !== "string") return json({ error: "listingId is required" }, 400);

    const { data: listing, error: listingError } = await admin
      .from("talent_exchange_listings")
      .select("id, client_organization_id, employee_full_name, employee_contact_email, employee_contact_phone, position_title, job_level, current_salary, current_work_location, release_reason_category, release_reason_note, status, consent_status")
      .eq("id", listingId)
      .maybeSingle();
    if (listingError || !listing) return json({ error: "Listing not found" }, 404);
    if (listing.status !== "active" || listing.consent_status !== "confirmed") {
      return json({ error: "This listing is not available" }, 400);
    }
    if (listing.client_organization_id === clientOrganizationId) {
      return json({ error: "You cannot reveal your own listing" }, 400);
    }

    const { data: releasingOrg } = await admin
      .from("client_organizations")
      .select("name")
      .eq("id", listing.client_organization_id)
      .maybeSingle();

    const { data: existingReveal } = await admin
      .from("talent_exchange_reveals")
      .select("id")
      .eq("client_organization_id", clientOrganizationId)
      .eq("listing_id", listingId)
      .maybeSingle();

    let creditsRemaining = org.credits_remaining ?? 0;

    if (!existingReveal) {
      if (creditsRemaining <= 0) {
        return json({ error: "No credits remaining", error_code: "no_credits_remaining" }, 402);
      }

      const { error: insertError } = await admin.from("talent_exchange_reveals").insert({
        listing_id: listingId,
        client_organization_id: clientOrganizationId,
        revealed_by: callerUserId,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          const { data: orgAfterRace } = await admin
            .from("client_organizations")
            .select("credits_remaining")
            .eq("id", clientOrganizationId)
            .maybeSingle();
          creditsRemaining = orgAfterRace?.credits_remaining ?? creditsRemaining;
        } else {
          return json({ error: insertError.message }, 500);
        }
      } else {
        const { data: decremented, error: decrementError } = await admin
          .from("client_organizations")
          .update({ credits_remaining: creditsRemaining - 1 })
          .eq("id", clientOrganizationId)
          .gt("credits_remaining", 0)
          .select("credits_remaining")
          .maybeSingle();

        if (decrementError) {
          await admin.from("talent_exchange_reveals").delete().eq("client_organization_id", clientOrganizationId).eq("listing_id", listingId);
          return json({ error: decrementError.message }, 500);
        }
        if (!decremented) {
          await admin.from("talent_exchange_reveals").delete().eq("client_organization_id", clientOrganizationId).eq("listing_id", listingId);
          return json({ error: "No credits remaining", error_code: "no_credits_remaining" }, 402);
        }
        creditsRemaining = decremented.credits_remaining;
      }
    }

    return json({
      id: listing.id,
      employee_full_name: listing.employee_full_name,
      employee_contact_email: listing.employee_contact_email,
      employee_contact_phone: listing.employee_contact_phone,
      position_title: listing.position_title,
      job_level: listing.job_level,
      current_salary: listing.current_salary,
      current_work_location: listing.current_work_location,
      release_reason_category: listing.release_reason_category,
      release_reason_note: listing.release_reason_note,
      releasing_company_name: releasingOrg?.name ?? null,
      credits_remaining: creditsRemaining,
    });
  } catch (error) {
    console.error("reveal-talent-exchange-listing error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
