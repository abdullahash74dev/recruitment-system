import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { ALLOW_ORIGIN } from "../_shared/cors.ts";
import {
  type Filter,
  type SynonymRow,
  clampInt,
  expandCanonicalFilters,
  applyFieldFilters,
  applySearch,
} from "../_shared/clientApplicantFilters.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const s = String(phone);
  if (s.length <= 2) return s + "********";
  return s.slice(0, 2) + "********";
}

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const s = String(email);
  const atIdx = s.indexOf("@");
  if (atIdx <= 0) return "***";
  const first = s[0];
  const domain = s.slice(atIdx + 1);
  const parts = domain.split(".").filter(Boolean);
  const lastSeg = parts.length > 0 ? parts[parts.length - 1] : "";
  return `${first}***@***${lastSeg ? "." + lastSeg : ""}`;
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
    let body: {
      filters?: Filter[];
      search?: string;
      searchMode?: string;
      page?: number;
      pageSize?: number;
      sortBy?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const rawFilters = Array.isArray(body.filters) ? body.filters : [];
    const search = typeof body.search === "string" ? body.search : undefined;
    const searchMode = body.searchMode === "all" ? "all" : "any";
    const page = clampInt(body.page, 1, 1, 1_000_000);
    const pageSize = clampInt(body.pageSize, 50, 1, 100); // never trust client pageSize blindly
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const sortAscending = body.sortBy === "oldest";

    // Fetch synonym groups once per request (small table) so canonical
    // filter values can be expanded into their literal member strings.
    const { data: synonymRows } = await supabaseAdmin
      .from("value_synonyms")
      .select("field_name, canonical_ar, canonical_en, synonyms");
    const filters = expandCanonicalFilters(rawFilters, (synonymRows || []) as SynonymRow[]);

    const selectColumns =
      "id, full_name, phone, email, desired_position, nationality, preferred_city, current_city, education_level, years_experience, current_title, job_type, created_at, resume_url";

    // 5. Query applicants (service role -- this function IS the authorization boundary).
    let dataQuery = supabaseAdmin.from("applicants").select(selectColumns);
    dataQuery = applyFieldFilters(dataQuery, filters);
    dataQuery = applySearch(dataQuery, search, searchMode);
    dataQuery = dataQuery.order("created_at", { ascending: sortAscending }).range(from, to);

    const { data: applicants, error: dataError } = await dataQuery;
    if (dataError) {
      return json({ error: dataError.message }, 400);
    }

    // Exact total count, same filters, no pagination.
    let countQuery = supabaseAdmin
      .from("applicants")
      .select("id", { count: "exact", head: true });
    countQuery = applyFieldFilters(countQuery, filters);
    countQuery = applySearch(countQuery, search, searchMode);
    const { count, error: countError } = await countQuery;
    if (countError) {
      return json({ error: countError.message }, 400);
    }

    // 5b. How many of ALL matching results (not just this page) has this org
    // already revealed -- powers the "X revealed / Y total" stats summary.
    // PostgREST embedded-resource filtering (candidate_reveals!inner) joins
    // via the FK on candidate_reveals.applicant_id, so this counts without
    // ever pulling the full id list client-side.
    let revealedCountQuery = supabaseAdmin
      .from("applicants")
      .select("id, candidate_reveals!inner(id)", { count: "exact", head: true })
      .eq("candidate_reveals.client_organization_id", clientOrganizationId);
    revealedCountQuery = applyFieldFilters(revealedCountQuery, filters);
    revealedCountQuery = applySearch(revealedCountQuery, search, searchMode);
    const { count: revealedInResults, error: revealedCountError } = await revealedCountQuery;
    if (revealedCountError) {
      return json({ error: revealedCountError.message }, 400);
    }

    // 6. Which of these applicants has this org already revealed?
    const ids = (applicants || []).map((a: { id: string }) => a.id);
    const revealedSet = new Set<string>();
    if (ids.length > 0) {
      const { data: reveals } = await supabaseAdmin
        .from("candidate_reveals")
        .select("applicant_id")
        .eq("client_organization_id", clientOrganizationId)
        .in("applicant_id", ids);
      for (const r of reveals || []) revealedSet.add(r.applicant_id);
    }

    // 7. Build masked/unmasked rows. resume_url is never sent as-is (it's a
    // private storage path, useless without a signed URL anyway) -- only
    // whether a résumé exists at all. The actual signed download link is
    // only ever minted by reveal-candidate, after a credit has been spent,
    // same as phone/email.
    const rows = (applicants || []).map((a: Record<string, unknown>) => {
      const isRevealed = revealedSet.has(a.id as string);
      return {
        id: a.id,
        full_name: a.full_name,
        desired_position: a.desired_position,
        nationality: a.nationality,
        preferred_city: a.preferred_city,
        current_city: a.current_city,
        education_level: a.education_level,
        years_experience: a.years_experience,
        current_title: a.current_title,
        job_type: a.job_type,
        created_at: a.created_at,
        is_revealed: isRevealed,
        has_resume: !!a.resume_url,
        phone: isRevealed ? (a.phone as string | null) : maskPhone(a.phone as string | null),
        email: isRevealed ? (a.email as string | null) : maskEmail(a.email as string | null),
      };
    });

    // 8. Respond.
    return json({
      rows,
      total: count ?? 0,
      revealed_in_results: revealedInResults ?? 0,
      credits_remaining: org.credits_remaining ?? 0,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
