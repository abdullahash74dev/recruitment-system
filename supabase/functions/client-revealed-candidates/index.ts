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

const PAGE_SIZE = 20;

function clampInt(value: unknown, def: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return def;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

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
      .select("id, subscription_status, expires_at")
      .eq("id", clientOrganizationId)
      .maybeSingle();
    if (orgError || !org) {
      return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    }
    const isExpired = !!org.expires_at && new Date(org.expires_at) <= new Date();
    if (org.subscription_status !== "active" || isExpired) {
      return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    }

    let body: { page?: number } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const page = clampInt(body.page, 1, 1, 1_000_000);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // Paginate candidate_reveals itself (not the joined applicant data) --
    // this is the org's own reveal history, which for a long-running,
    // frequently-renewed subscription could exceed PostgREST's default
    // 1000-row cap on an unbounded select. Requesting only PAGE_SIZE rows
    // per call via .range() never comes close to that ceiling, and an
    // explicit { count: 'exact' } alongside it gets the true total in the
    // same round trip.
    const { data: reveals, count: total, error: revealsError } = await supabaseAdmin
      .from("candidate_reveals")
      .select("applicant_id, revealed_at", { count: "exact" })
      .eq("client_organization_id", clientOrganizationId)
      .order("revealed_at", { ascending: false })
      .range(from, to);
    if (revealsError) {
      return json({ error: revealsError.message }, 400);
    }

    if (!reveals || reveals.length === 0) {
      return json({ rows: [], total: total ?? 0 });
    }

    const ids = reveals.map((r) => r.applicant_id as string);
    const revealedAtByApplicantId = new Map(reveals.map((r) => [r.applicant_id as string, r.revealed_at as string]));

    // Real contact info -- these are all already-paid-for reveals, no
    // masking needed.
    const { data: applicants, error: applicantsError } = await supabaseAdmin
      .from("applicants")
      .select("id, full_name, phone, email, desired_position, nationality, preferred_city, current_city, education_level, years_experience, resume_url")
      .in("id", ids);
    if (applicantsError) {
      return json({ error: applicantsError.message }, 400);
    }
    const applicantById = new Map((applicants || []).map((a) => [a.id as string, a]));

    // Re-order to match the reveal-date sort above (`.in()` doesn't
    // guarantee input order), skipping any applicant since deleted.
    const rows = await Promise.all(
      ids
        .map((id) => applicantById.get(id))
        .filter((a): a is NonNullable<typeof a> => !!a)
        .map(async (a) => {
          let resumeUrl: string | null = null;
          const rawResumePath = a.resume_url as string | null;
          if (rawResumePath) {
            if (rawResumePath.startsWith("http") || rawResumePath.startsWith("data:")) {
              resumeUrl = rawResumePath;
            } else {
              const { data: signed } = await supabaseAdmin.storage.from("resumes").createSignedUrl(rawResumePath, 3600);
              resumeUrl = signed?.signedUrl ?? null;
            }
          }
          return {
            id: a.id,
            full_name: a.full_name,
            phone: a.phone,
            email: a.email,
            desired_position: a.desired_position,
            nationality: a.nationality,
            preferred_city: a.preferred_city,
            current_city: a.current_city,
            education_level: a.education_level,
            years_experience: a.years_experience,
            has_resume: !!a.resume_url,
            resume_url: resumeUrl,
            revealed_at: revealedAtByApplicantId.get(a.id as string) ?? null,
          };
        })
    );

    return json({ rows, total: total ?? rows.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
