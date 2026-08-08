import type { ClientRevealedRow } from "@/hooks/queries/useClientPortalSearch";

interface ClientRevealedPrintTableProps {
  lang: "ar" | "en";
  rows: ClientRevealedRow[];
}

const dash = (v: string | null | undefined) => (v && v.trim() ? v : "—");

/**
 * Print-only table rasterized into the PDF export (see exportNodeToPdf /
 * clientPortalExport.ts) -- plain HTML+inline styles so html-to-image can
 * capture it without any Tailwind/CSS-in-JS dependency, and because this
 * project's jsPDF usage never draws Arabic text natively (no shaping-capable
 * font loaded), rendering it as a real DOM node the browser shapes
 * correctly and rasterizing THAT is the only working way to get legible
 * Arabic in the PDF (mirrors src/lib/hrForms/exportPdf.ts's approach).
 */
export default function ClientRevealedPrintTable({ lang, rows }: ClientRevealedPrintTableProps) {
  const ar = lang === "ar";
  const columns: { key: string; ar: string; en: string; get: (r: ClientRevealedRow) => string }[] = [
    { key: "name", ar: "الاسم", en: "Name", get: (r) => r.full_name },
    { key: "phone", ar: "الهاتف", en: "Phone", get: (r) => dash(r.phone) },
    { key: "email", ar: "الإيميل", en: "Email", get: (r) => dash(r.email) },
    { key: "position", ar: "الوظيفة المطلوبة", en: "Position", get: (r) => dash(r.desired_position) },
    { key: "city", ar: "المدينة", en: "City", get: (r) => dash(r.preferred_city || r.current_city) },
    { key: "experience", ar: "الخبرة", en: "Experience", get: (r) => dash(r.years_experience) },
    { key: "revealed_at", ar: "تاريخ الكشف", en: "Revealed", get: (r) => new Date(r.revealed_at).toLocaleDateString(ar ? "ar-SA" : "en-US") },
  ];

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ width: 700, padding: 16, background: "#fff", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        {ar ? "قائمة المرشحين المكشوفين" : "Revealed Candidates List"}
      </h1>
      <p style={{ fontSize: 10, color: "#666", marginBottom: 12 }}>
        {ar ? `${rows.length} مرشح` : `${rows.length} candidates`} — {new Date().toLocaleDateString(ar ? "ar-SA" : "en-US")}
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ border: "1px solid #ddd", padding: "4px 6px", textAlign: ar ? "right" : "left", background: "#f3f4f6" }}>
                {ar ? c.ar : c.en}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {columns.map((c) => (
                <td key={c.key} style={{ border: "1px solid #ddd", padding: "4px 6px" }}>
                  {c.get(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
