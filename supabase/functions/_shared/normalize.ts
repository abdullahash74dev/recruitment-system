// Shared helpers: load synonym maps + normalize raw values to canonical labels.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type Lang = "ar" | "en";

export interface SynonymRow {
  field_name: string;
  canonical_ar: string;
  canonical_en: string | null;
  synonyms: string[];
}

const norm = (s: string) => (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

export async function loadSynonymMap(supabaseUrl: string, serviceKey: string) {
  const admin = createClient(supabaseUrl, serviceKey);
  const { data } = await admin.from("value_synonyms").select("field_name,canonical_ar,canonical_en,synonyms").eq("is_active", true);
  const map = new Map<string, { ar: string; en: string }>(); // key = `${field}::${syn}` (lowercased)
  for (const r of (data || []) as SynonymRow[]) {
    const canon = { ar: r.canonical_ar, en: r.canonical_en || r.canonical_ar };
    for (const s of [r.canonical_ar, r.canonical_en, ...(r.synonyms || [])]) {
      if (!s) continue;
      map.set(`${r.field_name}::${norm(s)}`, canon);
    }
  }
  return map;
}

export function normalizeValue(map: Map<string, { ar: string; en: string }>, field: string, value: any, lang: Lang = "ar"): string {
  if (value === null || value === undefined || value === "") return "";
  const hit = map.get(`${field}::${norm(String(value))}`);
  if (!hit) return String(value);
  return lang === "en" ? hit.en : hit.ar;
}
