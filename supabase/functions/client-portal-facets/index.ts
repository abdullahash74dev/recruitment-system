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

// Kept in lockstep with client-search-applicants/index.ts (duplicated, not
// imported -- each edge function is deployed/pasted independently).
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

type Filter = { field: string; value: string };
type SynonymRow = { field_name: string; canonical_ar: string; canonical_en: string | null; synonyms: string[] };

// Ported verbatim from src/hooks/useValueSynonyms.ts's normText(), so a raw
// applicant value normalizes identically here and in the admin dashboard.
function normText(s: string | null | undefined): string {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/['’`"]/g, "")
    .replace(/[\s\-_،,.()\/]+/g, " ")
    .trim();
}

// Same expand-canonical-filter-value logic as client-search-applicants, used
// here so facet counts respect any OTHER already-applied canonical filters.
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

// Groups raw distinct values into their canonical synonym group where one
// exists (exact-normalized match, then longest-substring fallback -- mirrors
// resolveSynonym() in src/hooks/useValueSynonyms.ts), summing counts per
// group. Values with no matching group pass through unchanged.
function groupBySynonym(
  counts: Map<string, number>,
  synonymRows: SynonymRow[],
  synField: string | undefined
): { value: string; count: number; label: string; isGroup?: boolean }[] {
  if (!synField) {
    return Array.from(counts.entries()).map(([value, count]) => ({ value, count, label: value }));
  }

  const fieldRows = synonymRows.filter((r) => r.field_name === synField);
  if (fieldRows.length === 0) {
    return Array.from(counts.entries()).map(([value, count]) => ({ value, count, label: value }));
  }

  // Precompute normalized member lists once per group row.
  const rowVariants = fieldRows.map((r) => ({
    row: r,
    normVariants: [r.canonical_ar, r.canonical_en || "", ...(r.synonyms || [])].map(normText).filter(Boolean),
  }));

  const groupTotals = new Map<string, number>(); // canonical_ar -> summed count
  const ungrouped: { value: string; count: number }[] = [];

  for (const [rawValue, count] of counts.entries()) {
    const v = normText(rawValue);
    if (!v) continue;

    let matchedCanonical: string | null = null;

    // Exact normalized match first.
    for (const { row, normVariants } of rowVariants) {
      if (normVariants.includes(v)) {
        matchedCanonical = row.canonical_ar;
        break;
      }
    }

    // Substring fallback, preferring the longest matching synonym.
    if (!matchedCanonical) {
      let best: { canonical: string; len: number } | null = null;
      for (const { row, normVariants } of rowVariants) {
        for (const nv of normVariants) {
          if (nv.length >= 3 && v.includes(nv) && (!best || nv.length > best.len)) {
            best = { canonical: row.canonical_ar, len: nv.length };
          }
        }
      }
      if (best) matchedCanonical = best.canonical;
    }

    if (matchedCanonical) {
      groupTotals.set(matchedCanonical, (groupTotals.get(matchedCanonical) || 0) + count);
    } else {
      ungrouped.push({ value: rawValue, count });
    }
  }

  const grouped = Array.from(groupTotals.entries()).map(([canonical_ar, count]) => ({
    value: `${CANON_PREFIX}${canonical_ar}`,
    count,
    label: canonical_ar,
    isGroup: true,
  }));

  return [...grouped, ...ungrouped.map((u) => ({ value: u.value, count: u.count, label: u.value }))];
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

    const { data: org, error: orgError } = await supabaseAdmin
      .from("client_organizations")
      .select("id, subscription_status, expires_at")
      .eq("id", clientUser.client_organization_id)
      .maybeSingle();
    if (orgError || !org) {
      return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    }
    const isExpired = !!org.expires_at && new Date(org.expires_at) <= new Date();
    if (org.subscription_status !== "active" || isExpired) {
      return json({ error: "Subscription inactive or expired", error_code: "subscription_expired" }, 403);
    }

    let body: { field?: unknown; filters?: Filter[]; search?: unknown; searchMode?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const field = typeof body.field === "string" ? body.field : "";
    if (!QUERYABLE_FIELD_SET.has(field)) {
      return json({ error: "Unknown field" }, 400);
    }
    const otherFilters = Array.isArray(body.filters) ? body.filters : [];
    const search = typeof body.search === "string" ? body.search : "";
    const searchMode = body.searchMode === "all" ? "all" : "any";

    const { data: synonymRows } = await supabaseAdmin
      .from("value_synonyms")
      .select("field_name, canonical_ar, canonical_en, synonyms");
    const rows = (synonymRows || []) as SynonymRow[];
    const expandedOtherFilters = expandCanonicalFilters(otherFilters, rows);

    // Real server-side GROUP BY via RPC (see the client_portal_facet_counts
    // migration) -- NOT a `select(field)` + JS-side count. PostgREST caps an
    // unpaginated select at 1000 rows, which on a ~100k-row applicants table
    // silently under-counts every facet from only its first 1000 matches.
    const { data, error } = await supabaseAdmin.rpc("client_portal_facet_counts", {
      p_field: field,
      p_filters: expandedOtherFilters,
      p_search: search || null,
      p_search_mode: searchMode,
    });
    if (error) {
      return json({ error: error.message }, 400);
    }

    const counts = new Map<string, number>();
    for (const row of (data || []) as { value: string; count: number }[]) {
      if (!row.value) continue;
      counts.set(row.value, Number(row.count));
    }

    const values = groupBySynonym(counts, rows, SYNONYM_FIELD_MAP[field]);
    values.sort((a, b) => b.count - a.count);

    return json({ values });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
