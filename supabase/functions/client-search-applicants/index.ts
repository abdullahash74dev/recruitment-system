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

// Same 19 fields exposed by the admin ApplicantsAdvancedFilters.tsx UI.
// Anything not in this list is silently ignored (never passed to the query
// builder), so a caller cannot inject an arbitrary column name.
const QUERYABLE_FIELDS = [
  "nationality",
  "desired_position",
  "preferred_city",
  "current_city",
  "gender",
  "marital_status",
  "education_level",
  "major",
  "university",
  "job_type",
  "years_experience",
  "current_title",
  "currently_employed",
  "has_transport",
  "arabic_level",
  "english_level",
  "hear_about",
  "source",
  "source_company",
] as const;
const QUERYABLE_FIELD_SET = new Set<string>(QUERYABLE_FIELDS);

type Filter = { field: string; value: string };

// PostgREST's .or()/.ilike() filter strings use "," to separate conditions and
// "()" for grouping, so a raw value containing those could break out of the
// intended clause. Strip them defensively — worst case a stray comma/paren in
// someone's search term gets dropped, it never lets them add a new clause.
function sanitizeFilterValue(value: string): string {
  return String(value).replace(/[(),]/g, "").trim();
}

function clampInt(value: unknown, def: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return def;
  return Math.min(Math.max(Math.trunc(n), min), max);
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

// Applies is_archived + the allow-listed advanced filters + free-text search
// to a query builder. Mirrors the admin UI's semantics: multiple filters on
// the SAME field are OR'd together, filters across DIFFERENT fields are AND'd.
// deno-lint-ignore no-explicit-any
function applyFilters(query: any, filters: Filter[], search?: string) {
  query = query.eq("is_archived", false);

  const byField = new Map<string, string[]>();
  for (const f of filters) {
    if (!f || typeof f.field !== "string" || typeof f.value !== "string") continue;
    if (!QUERYABLE_FIELD_SET.has(f.field)) continue; // reject unknown fields
    const cleanValue = sanitizeFilterValue(f.value);
    if (!cleanValue) continue;
    const arr = byField.get(f.field) || [];
    arr.push(cleanValue);
    byField.set(f.field, arr);
  }

  for (const [field, values] of byField.entries()) {
    const orExpr = values.map((v) => `${field}.ilike.%${v}%`).join(",");
    query = query.or(orExpr);
  }

  if (search && typeof search === "string") {
    const term = sanitizeFilterValue(search);
    if (term) {
      query = query.or(`full_name.ilike.%${term}%,desired_position.ilike.%${term}%`);
    }
  }

  return query;
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
      page?: number;
      pageSize?: number;
    } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const filters = Array.isArray(body.filters) ? body.filters : [];
    const search = typeof body.search === "string" ? body.search : undefined;
    const page = clampInt(body.page, 1, 1, 1_000_000);
    const pageSize = clampInt(body.pageSize, 50, 1, 100); // never trust client pageSize blindly
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const selectColumns =
      "id, full_name, phone, email, desired_position, nationality, preferred_city, current_city, education_level, years_experience, current_title, job_type, created_at";

    // 5. Query applicants (service role — this function IS the authorization boundary).
    let dataQuery = supabaseAdmin.from("applicants").select(selectColumns);
    dataQuery = applyFilters(dataQuery, filters, search);
    dataQuery = dataQuery.order("created_at", { ascending: false }).range(from, to);

    const { data: applicants, error: dataError } = await dataQuery;
    if (dataError) {
      return json({ error: dataError.message }, 400);
    }

    // Exact total count, same filters, no pagination.
    let countQuery = supabaseAdmin
      .from("applicants")
      .select("id", { count: "exact", head: true });
    countQuery = applyFilters(countQuery, filters, search);
    const { count, error: countError } = await countQuery;
    if (countError) {
      return json({ error: countError.message }, 400);
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

    // 7. Build masked/unmasked rows.
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
        phone: isRevealed ? (a.phone as string | null) : maskPhone(a.phone as string | null),
        email: isRevealed ? (a.email as string | null) : maskEmail(a.email as string | null),
      };
    });

    // 8. Respond.
    return json({
      rows,
      total: count ?? 0,
      credits_remaining: org.credits_remaining ?? 0,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
