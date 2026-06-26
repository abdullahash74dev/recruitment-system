import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";

export type SynonymRow = {
  id: string;
  field_name: string;
  canonical_ar: string;
  canonical_en: string | null;
  synonyms: string[];
};

// Normalize text for matching (mirrors analyticsNormalize.ts)
export const normText = (s: string | null | undefined) =>
  (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/['’`"]/g, "")
    .replace(/[\s\-_،,.()\/]+/g, " ")
    .trim();

const SYNONYMS_QUERY_KEY = queryKeys.valueSynonyms.all;

async function fetchRowsRaw(): Promise<SynonymRow[]> {
  const { data } = await supabase.from("value_synonyms").select("*");
  return (data || []) as SynonymRow[];
}

// lookupSynonym() is called once per applicant in several places (filtering,
// analytics charts) and redoes several regex passes per call — on 60k+ rows
// that's enough to block the main thread. Memoize per field/lang/normalized
// value (nested maps, not a concatenated string key, so no collision risk),
// keyed off the cached rows array reference so a refresh invalidates it.
let lookupCacheRows: SynonymRow[] | null = null;
let lookupCache = new Map<string, Map<string, Map<string, string | null>>>();

function getLookupCache(rows: SynonymRow[]) {
  if (lookupCacheRows !== rows) {
    lookupCacheRows = rows;
    lookupCache = new Map();
  }
  return lookupCache;
}

export function useValueSynonyms() {
  // Bound directly to the singleton queryClient (not context) so this shares
  // the cache with getSynonymsCache/lookupSynonym even outside a
  // QueryClientProvider (e.g. in tests).
  const query = useQuery(
    { queryKey: SYNONYMS_QUERY_KEY, queryFn: fetchRowsRaw, staleTime: Infinity },
    queryClient,
  );
  const refresh = () => queryClient.fetchQuery({ queryKey: SYNONYMS_QUERY_KEY, queryFn: fetchRowsRaw, staleTime: 0 });
  return { rows: query.data ?? [], isLoading: query.isLoading, refresh };
}

// Synchronous accessor (best-effort: uses cache; if empty, returns null and falls back)
export function getSynonymsCache(): SynonymRow[] | null {
  return queryClient.getQueryData<SynonymRow[]>(SYNONYMS_QUERY_KEY) ?? null;
}

export async function ensureSynonymsLoaded() {
  return queryClient.fetchQuery({ queryKey: SYNONYMS_QUERY_KEY, queryFn: fetchRowsRaw, staleTime: Infinity });
}

/**
 * Look up a canonical label for a value from DB synonyms.
 * Returns null if no match — caller should fall back to built-in normalizer.
 * Matches:
 *  1. exact normalized match of canonical or any synonym
 *  2. substring match: value contains any synonym (longer synonyms win)
 */
export function lookupSynonym(
  fieldName: string,
  value: string | null | undefined,
  lang: "ar" | "en"
): string | null {
  const cache = getSynonymsCache();
  if (!cache || !value) return null;
  const v = normText(value);
  if (!v) return null;

  const lookupCache = getLookupCache(cache);
  let byLang = lookupCache.get(fieldName);
  if (!byLang) {
    byLang = new Map();
    lookupCache.set(fieldName, byLang);
  }
  let byValue = byLang.get(lang);
  if (!byValue) {
    byValue = new Map();
    byLang.set(lang, byValue);
  }
  if (byValue.has(v)) return byValue.get(v)!;

  const result = resolveSynonym(cache, fieldName, v, lang);
  byValue.set(v, result);
  return result;
}

function resolveSynonym(cache: SynonymRow[], fieldName: string, v: string, lang: "ar" | "en"): string | null {
  const fieldRows = cache.filter(r => r.field_name === fieldName);
  if (fieldRows.length === 0) return null;

  // Exact match first
  for (const r of fieldRows) {
    const all = [r.canonical_ar, r.canonical_en || "", ...(r.synonyms || [])]
      .map(normText)
      .filter(Boolean);
    if (all.includes(v)) return lang === "ar" ? r.canonical_ar : (r.canonical_en || r.canonical_ar);
  }

  // Substring match — prefer longest synonym
  let best: { row: SynonymRow; len: number } | null = null;
  for (const r of fieldRows) {
    const all = [r.canonical_ar, r.canonical_en || "", ...(r.synonyms || [])]
      .map(normText)
      .filter(s => s.length >= 3);
    for (const s of all) {
      if (v.includes(s) && (!best || s.length > best.len)) {
        best = { row: r, len: s.length };
      }
    }
  }
  if (best) return lang === "ar" ? best.row.canonical_ar : (best.row.canonical_en || best.row.canonical_ar);
  return null;
}
