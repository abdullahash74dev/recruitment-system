import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify the caller via the Bearer token.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }

    const callerUserId = claimsData.claims.sub;

    // 2. Caller must be an active client_users row.
    const { data: clientUser, error: clientUserError } = await supabaseAdmin
      .from("client_users")
      .select("id, client_organization_id, is_active")
      .eq("user_id", callerUserId)
      .maybeSingle();

    if (clientUserError || !clientUser || !clientUser.is_active) {
      return json({ error: "Not an active client user" }, 403);
    }

    const clientOrganizationId = clientUser.client_organization_id;

    // 3. The org's subscription must be active and not expired.
    const { data: org, error: orgError } = await supabaseAdmin
      .from("client_organizations")
      .select("id, subscription_status, expires_at, credits_remaining")
      .eq("id", clientOrganizationId)
      .maybeSingle();

    if (orgError || !org) {
      return json(
        { error: "Subscription inactive or expired", error_code: "subscription_expired" },
        403
      );
    }

    const now = new Date();
    const isExpired = !!org.expires_at && new Date(org.expires_at) <= now;
    if (org.subscription_status !== "active" || isExpired) {
      return json(
        { error: "Subscription inactive or expired", error_code: "subscription_expired" },
        403
      );
    }

    // 4. Parse + validate the request body.
    let body: { applicant_id?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const applicantId = body.applicant_id;
    if (typeof applicantId !== "string" || applicantId.trim().length === 0) {
      return json({ error: "applicant_id is required" }, 400);
    }

    // Make sure the applicant actually exists before doing anything else --
    // avoids inserting a candidate_reveals row / burning a credit for a
    // bogus id, and gives us the row we need to return in step 7.
    const { data: applicant, error: applicantError } = await supabaseAdmin
      .from("applicants")
      .select("id, full_name, phone, email, desired_position")
      .eq("id", applicantId)
      .maybeSingle();

    if (applicantError || !applicant) {
      return json({ error: "Applicant not found" }, 404);
    }

    // 5. Has this org already revealed this applicant? If so, it's a free
    // re-fetch -- no credit is charged twice for the same applicant.
    const { data: existingReveal, error: existingRevealError } = await supabaseAdmin
      .from("candidate_reveals")
      .select("id")
      .eq("client_organization_id", clientOrganizationId)
      .eq("applicant_id", applicantId)
      .maybeSingle();

    if (existingRevealError) {
      return json({ error: existingRevealError.message }, 500);
    }

    let creditsRemaining = org.credits_remaining ?? 0;

    if (!existingReveal) {
      // 6. Not revealed yet -- this reveal must consume one credit.
      if (creditsRemaining <= 0) {
        return json({ error: "No credits remaining", error_code: "no_credits_remaining" }, 402);
      }

      // Insert the reveal row first (unique on (client_organization_id,
      // applicant_id) protects against double-inserts from a concurrent
      // request for the same applicant).
      const { error: insertError } = await supabaseAdmin
        .from("candidate_reveals")
        .insert({
          client_organization_id: clientOrganizationId,
          applicant_id: applicantId,
          revealed_by: callerUserId,
        });

      if (insertError) {
        // Unique violation means a concurrent request already revealed this
        // applicant for this org -- treat it as the free-re-fetch path.
        if (insertError.code === "23505") {
          const { data: orgAfterRace } = await supabaseAdmin
            .from("client_organizations")
            .select("credits_remaining")
            .eq("id", clientOrganizationId)
            .maybeSingle();
          creditsRemaining = orgAfterRace?.credits_remaining ?? creditsRemaining;
        } else {
          return json({ error: insertError.message }, 500);
        }
      } else {
        // Atomic, race-safe decrement: only succeeds if credits are still
        // available at the moment of the UPDATE, regardless of what we read
        // earlier. If two requests race past the read-check above, only one
        // of these UPDATEs can affect a row.
        const { data: decremented, error: decrementError } = await supabaseAdmin
          .from("client_organizations")
          .update({ credits_remaining: creditsRemaining - 1 })
          .eq("id", clientOrganizationId)
          .gt("credits_remaining", 0)
          .select("credits_remaining")
          .maybeSingle();

        if (decrementError) {
          // Roll back the reveal we just inserted -- we couldn't charge for it.
          await supabaseAdmin
            .from("candidate_reveals")
            .delete()
            .eq("client_organization_id", clientOrganizationId)
            .eq("applicant_id", applicantId);
          return json({ error: decrementError.message }, 500);
        }

        if (!decremented) {
          // Lost the race: credits hit 0 between our read and this UPDATE.
          // Roll back the reveal insert so the applicant isn't unlocked for
          // free, and report no credits remaining.
          await supabaseAdmin
            .from("candidate_reveals")
            .delete()
            .eq("client_organization_id", clientOrganizationId)
            .eq("applicant_id", applicantId);
          return json({ error: "No credits remaining", error_code: "no_credits_remaining" }, 402);
        }

        creditsRemaining = decremented.credits_remaining;
      }
    }

    // 7. Return the applicant's real contact details.
    return json({
      phone: applicant.phone,
      email: applicant.email,
      full_name: applicant.full_name,
      desired_position: applicant.desired_position,
      credits_remaining: creditsRemaining,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
