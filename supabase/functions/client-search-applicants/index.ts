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

// Mirrors ApplicantsAdvancedFilters.tsx's SYNONYM_FIELD_MAP -- maps a
// filterable applicants column to its value_synonyms.field_name group.
// current_city is the odd one out: it shares the "city" group with
// preferred_city.
const SYNONYM_FIELD_MAP: Record<string, string> = {
  nationality: "nationality",
  desired_position: "desired_position",
  preferred_city: "preferred_city",
  current_city: "city",
  gender: "gender",
  marital_status: "marital_status",
  education_level: "education_level",
  major: "major",
  university: "university",
  job_type: "job_type",
  current_title: "current_title",
  currently_employed: "currently_employed",
  has_transport: "has_transport",
  arabic_level: "arabic_level",
  english_level: "english_level",
  hear_about: "hear_about",
};

const CANON_PREFIX = "__canon__:";

// Free-text search columns -- wider than admin's dashboard quick-search
// (full_name/desired_position only), since client-portal users have no
// other way to browse the pool besides search + filters.
const SEARCH_COLUMNS = [
  "full_name",
  "desired_position",
  "current_title",
  "major",
  "university",
  "nationality",
  "current_city",
  "preferred_city",
];

type Filter = { field: string; value: string };
type SynonymRow = { field_name: string; canonical_ar: string; canonical_en: string | null; synonyms: string[] };

// PostgREST's .or()/.ilike() filter strings use "," to separate conditions and
// "()" for grouping, so a raw value containing those could break out of the
// intended clause. Strip them defensively -- worst case a stray comma/paren in
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

// A "__canon__:<canonical_ar>" filter value means "match any known synonym
// of this group", not a literal substring. Expand it into one literal
// filter per group member (canonical_ar/canonical_en/synonyms[]) so the
// rest of the pipeline can keep treating everything as plain ilike values.
// Unknown canonical keys (e.g. a stale group an admin since deleted) are
// dropped silently rather than matching nothing-vs-erroring.
function expandCanonicalFilters(filters: Filter[], synonymRows: SynonymRow[]): Filter[] {
  const out: Filter[] = [];
  for (const f of filters) {
    if (!f || typeof f.field !== "string" || typeof f.value !== "string") continue;
    if (!QUERYABLE_FIELD_SET.has(f.field)) continue;
    if (!f.value.startsWith(CANON_PREFIX)) {
      out.push(f);
      continue;
    }
    const canonical = f.value.slice(CANON_PREFIX.length);
    const synField = SYNONYM_FIELD_MAP[f.field];
    const row = synField
      ? synonymRows.find((r) => r.field_name === synField && r.canonical_ar === canonical)
      : undefined;
    if (!row) continue;
    const variants = [row.canonical_ar, row.canonical_en, ...(row.synonyms || [])].filter(Boolean) as string[];
    for (const v of variants) out.push({ field: f.field, value: v });
  }
  return out;
}

// Applies is_archived + the allow-listed advanced filters to a query
// builder. Mirrors the admin UI's semantics: multiple filters on the SAME
// field are OR'd together, filters across DIFFERENT fields are AND'd.
// deno-lint-ignore no-explicit-any
function applyFieldFilters(query: any, filters: Filter[]) {
  query = query.eq("is_archived", false);

  const byField = new Map<string, string[]>();
  for (const f of filters) {
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

  return query;
}

// Boolean free-text search across SEARCH_COLUMNS. "any" = at least one word
// matches at least one column (single OR clause). "all" = every word must
// match at least one column (one .or() call per word -- chained .or() calls
// AND together, same mechanism applyFieldFilters uses across fields).
// deno-lint-ignore no-explicit-any
function applySearch(query: any, search: string | undefined, mode: string | undefined) {
  const term = (search || "").trim();
  if (!term) return query;
  const words = term.split(/\s+/).map(sanitizeFilterValue).filter(Boolean);
  if (words.length === 0) return query;

  if (mode === "all") {
    for (const w of words) {
      query = query.or(SEARCH_COLUMNS.map((c) => `${c}.ilike.%${w}%`).join(","));
    }
  } else {
    query = query.or(words.flatMap((w) => SEARCH_COLUMNS.map((c) => `${c}.ilike.%${w}%`)).join(","));
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
      searchMode?: string;
      page?: number;
      pageSize?: number;
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
    dataQuery = dataQuery.order("created_at", { ascending: false }).range(from, to);

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
      credits_remaining: org.credits_remaining ?? 0,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
