// Shared applicant-filter query-building logic for the client portal.
// Used by client-search-applicants (interactive search) and
// check-saved-filter-alerts (the cron job that watches saved filters for
// new matches) so both apply IDENTICAL matching semantics -- an alert
// firing (or not) always agrees with what the client would see if they
// re-ran the same search in the portal.

// Same 19 fields exposed by the admin ApplicantsAdvancedFilters.tsx UI.
// Anything not in this list is silently ignored (never passed to the query
// builder), so a caller cannot inject an arbitrary column name.
export const QUERYABLE_FIELDS = [
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
export const QUERYABLE_FIELD_SET = new Set<string>(QUERYABLE_FIELDS);

// Mirrors ApplicantsAdvancedFilters.tsx's SYNONYM_FIELD_MAP -- maps a
// filterable applicants column to its value_synonyms.field_name group.
// current_city is the odd one out: it shares the "city" group with
// preferred_city.
export const SYNONYM_FIELD_MAP: Record<string, string> = {
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

export const CANON_PREFIX = "__canon__:";

// Free-text search columns -- wider than admin's dashboard quick-search
// (full_name/desired_position only), since client-portal users have no
// other way to browse the pool besides search + filters.
export const SEARCH_COLUMNS = [
  "full_name",
  "desired_position",
  "current_title",
  "major",
  "university",
  "nationality",
  "current_city",
  "preferred_city",
];

export type Filter = { field: string; value: string };
export type SynonymRow = { field_name: string; canonical_ar: string; canonical_en: string | null; synonyms: string[] };

// PostgREST's .or()/.ilike() filter strings use "," to separate conditions and
// "()" for grouping, so a raw value containing those could break out of the
// intended clause. Strip them defensively -- worst case a stray comma/paren in
// someone's search term gets dropped, it never lets them add a new clause.
export function sanitizeFilterValue(value: string): string {
  return String(value).replace(/[(),]/g, "").trim();
}

export function clampInt(value: unknown, def: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return def;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

// A "__canon__:<canonical_ar>" filter value means "match any known synonym
// of this group", not a literal substring. Expand it into one literal
// filter per group member (canonical_ar/canonical_en/synonyms[]) so the
// rest of the pipeline can keep treating everything as plain ilike values.
// Unknown canonical keys (e.g. a stale group an admin since deleted) are
// dropped silently rather than matching nothing-vs-erroring.
export function expandCanonicalFilters(filters: Filter[], synonymRows: SynonymRow[]): Filter[] {
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
export function applyFieldFilters(query: any, filters: Filter[]) {
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
export function applySearch(query: any, search: string | undefined, mode: string | undefined) {
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
