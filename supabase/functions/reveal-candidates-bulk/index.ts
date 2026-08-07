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

// Bulk-select reveal, capped well below any plausible one-page selection so
// a single request can't be used to slowly drain a whole org's credits in
// one shot without the per-item UI ever showing progress.
const MAX_BULK_IDS = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const { data: clientUser, error: clientUserError } = await supabaseAdmin
      .from("client_users")
      .select("id, client_organization_id, is_active")
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (clientUserError || !clientUser || !clientUser.is_active) {
      return json({ error: "Not an active client user" }, 403);
    }
    const clientOrganizationId = clientUser.client_organization_id;

    const { data: org, error: orgError } = await supabaseAdmin
      .from("client_organizations")
      .select("id, subscription_status, expires_at, credits_remaining")
      .eq("id", clientOrganizationId)
      .maybeSingle();
    if (orgError || !org) {
      return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    }
    const isExpired = !!org.expires_at && new Date(org.expires_at) <= new Date();
    if (org.subscription_status !== "active" || isExpired) {
      return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    }

    let body: { applicant_ids?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const rawIds = Array.isArray(body.applicant_ids) ? body.applicant_ids : [];
    const applicantIds = [...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
    if (applicantIds.length === 0) {
      return json({ error: "applicant_ids is required" }, 400);
    }
    if (applicantIds.length > MAX_BULK_IDS) {
      return json({ error: `Cannot reveal more than ${MAX_BULK_IDS} at once` }, 400);
    }

    const { data: applicants, error: applicantsError } = await supabaseAdmin
      .from("applicants")
      .select("id, full_name, phone, email, desired_position, resume_url")
      .in("id", applicantIds);
    if (applicantsError) {
      return json({ error: applicantsError.message }, 500);
    }
    const applicantById = new Map((applicants || []).map((a) => [a.id as string, a]));

    const { data: existingReveals } = await supabaseAdmin
      .from("candidate_reveals")
      .select("applicant_id")
      .eq("client_organization_id", clientOrganizationId)
      .in("applicant_id", applicantIds);
    const alreadyRevealed = new Set((existingReveals || []).map((r) => r.applicant_id as string));

    let creditsRemaining = org.credits_remaining ?? 0;
    const revealed: {
      applicant_id: string;
      full_name: string | null;
      phone: string | null;
      email: string | null;
      desired_position: string | null;
      resume_url: string | null;
    }[] = [];
    const failed: { applicant_id: string; reason: "not_found" | "no_credits" | "error" }[] = [];

    // Sequential, not parallel -- each item's credit decrement must observe
    // the previous item's result, and per-item errors need to short-circuit
    // the whole rest of the batch predictably instead of racing.
    for (const id of applicantIds) {
      const applicant = applicantById.get(id);
      if (!applicant) {
        failed.push({ applicant_id: id, reason: "not_found" });
        continue;
      }

      if (!alreadyRevealed.has(id)) {
        if (creditsRemaining <= 0) {
          failed.push({ applicant_id: id, reason: "no_credits" });
          continue;
        }

        const { error: insertError } = await supabaseAdmin.from("candidate_reveals").insert({
          client_organization_id: clientOrganizationId,
          applicant_id: id,
          revealed_by: callerUserId,
        });

        if (insertError && insertError.code !== "23505") {
          failed.push({ applicant_id: id, reason: "error" });
          continue;
        }

        if (!insertError) {
          const { data: decremented, error: decrementError } = await supabaseAdmin
            .from("client_organizations")
            .update({ credits_remaining: creditsRemaining - 1 })
            .eq("id", clientOrganizationId)
            .gt("credits_remaining", 0)
            .select("credits_remaining")
            .maybeSingle();

          if (decrementError || !decremented) {
            await supabaseAdmin
              .from("candidate_reveals")
              .delete()
              .eq("client_organization_id", clientOrganizationId)
              .eq("applicant_id", id);
            failed.push({ applicant_id: id, reason: "no_credits" });
            continue;
          }
          creditsRemaining = decremented.credits_remaining;
        }
        // insertError.code === "23505": a concurrent request already revealed
        // this one for this org -- fall through to the free-reveal response
        // below without charging again.
      }

      let resumeUrl: string | null = null;
      const rawResumePath = applicant.resume_url as string | null;
      if (rawResumePath) {
        if (rawResumePath.startsWith("http") || rawResumePath.startsWith("data:")) {
          resumeUrl = rawResumePath;
        } else {
          const { data: signed } = await supabaseAdmin.storage.from("resumes").createSignedUrl(rawResumePath, 3600);
          resumeUrl = signed?.signedUrl ?? null;
        }
      }

      revealed.push({
        applicant_id: id,
        full_name: applicant.full_name,
        phone: applicant.phone,
        email: applicant.email,
        desired_position: applicant.desired_position,
        resume_url: resumeUrl,
      });
    }

    return json({ revealed, failed, credits_remaining: creditsRemaining });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
