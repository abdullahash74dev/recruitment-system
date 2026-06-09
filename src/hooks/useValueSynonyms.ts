import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

// Module-level cache so charts and pickers share the same data
let cache: SynonymRow[] | null = null;
const listeners = new Set<(rows: SynonymRow[]) => void>();

async function fetchRows() {
  const { data } = await supabase.from("value_synonyms").select("*");
  cache = (data || []) as SynonymRow[];
  listeners.forEach(l => l(cache!));
  return cache;
}

export function useValueSynonyms() {
  const [rows, setRows] = useState<SynonymRow[]>(cache || []);
  useEffect(() => {
    if (!cache) fetchRows();
    else setRows(cache);
    const l = (r: SynonymRow[]) => setRows(r);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const refresh = useCallback(() => fetchRows(), []);
  return { rows, refresh };
}

// Synchronous accessor (best-effort: uses cache; if empty, returns null and falls back)
export function getSynonymsCache(): SynonymRow[] | null {
  return cache;
}

export async function ensureSynonymsLoaded() {
  if (!cache) await fetchRows();
  return cache || [];
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
  if (!cache || !value) return null;
  const v = normText(value);
  if (!v) return null;
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
