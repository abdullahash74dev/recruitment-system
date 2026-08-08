import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { ClientRevealedRow } from "@/hooks/queries/useClientPortalSearch";

const PAGE_SIZE = 20;
// Same spirit as reveal-candidates-bulk's cap -- a hard ceiling so exporting
// never turns into an unbounded loop against a runaway reveal history.
const MAX_PAGES = 100;

/** Loops client-revealed-candidates until every page is collected -- the
 * export needs the org's FULL reveal history, not just the 20 rows visible
 * on the current page of the tab. */
export async function fetchAllRevealedCandidates(): Promise<ClientRevealedRow[]> {
  const all: ClientRevealedRow[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await supabase.functions.invoke("client-revealed-candidates", {
      body: { page },
    });
    if (error) throw error;
    const rows = (data?.rows || []) as ClientRevealedRow[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

function toExportRows(rows: ClientRevealedRow[], ar: boolean) {
  return rows.map((r) => ({
    [ar ? "الاسم" : "Name"]: r.full_name,
    [ar ? "الهاتف" : "Phone"]: r.phone || "",
    [ar ? "الإيميل" : "Email"]: r.email || "",
    [ar ? "الوظيفة المطلوبة" : "Desired Position"]: r.desired_position || "",
    [ar ? "الجنسية" : "Nationality"]: r.nationality || "",
    [ar ? "المدينة" : "City"]: r.preferred_city || r.current_city || "",
    [ar ? "المؤهل العلمي" : "Education"]: r.education_level || "",
    [ar ? "سنوات الخبرة" : "Experience"]: r.years_experience || "",
    [ar ? "تاريخ الكشف" : "Revealed On"]: new Date(r.revealed_at).toLocaleDateString(ar ? "ar-SA" : "en-US"),
  }));
}

export function exportRevealedToExcel(rows: ClientRevealedRow[], lang: "ar" | "en") {
  const ar = lang === "ar";
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(toExportRows(rows, ar));
  XLSX.utils.book_append_sheet(wb, ws, ar ? "المكشوفين" : "Revealed");
  const ts = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `revealed-candidates-${ts}.xlsx`);
}
