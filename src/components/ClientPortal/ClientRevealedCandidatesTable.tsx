import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Mail, SearchX, FileText } from "lucide-react";
import type { ClientRevealedRow } from "@/hooks/queries/useClientPortalSearch";

interface ClientRevealedCandidatesTableProps {
  lang: "ar" | "en";
  rows: ClientRevealedRow[];
  isLoading: boolean;
}

const dash = (v: string | null | undefined) => (v && v.trim() ? v : "—");

const DATA_COLUMNS: {
  key: string;
  ar: string;
  en: string;
  getValue: (row: ClientRevealedRow) => string | null | undefined;
}[] = [
  { key: "position", ar: "الوظيفة المطلوبة", en: "Desired Position", getValue: (r) => r.desired_position },
  { key: "nationality", ar: "الجنسية", en: "Nationality", getValue: (r) => r.nationality },
  { key: "city", ar: "المدينة", en: "City", getValue: (r) => r.preferred_city || r.current_city },
  { key: "education", ar: "المؤهل العلمي", en: "Education", getValue: (r) => r.education_level },
  { key: "experience", ar: "سنوات الخبرة", en: "Experience", getValue: (r) => r.years_experience },
];

/**
 * Read-only history of every candidate this org has ever revealed (across
 * all past searches, not just the current one) -- unlike ClientResultsTable,
 * there's no lock/reveal button here since every row is already paid for and
 * always shows real contact info straight from the edge function.
 */
export default function ClientRevealedCandidatesTable({ lang, rows, isLoading }: ClientRevealedCandidatesTableProps) {
  const ar = lang === "ar";

  const visibleDataColumns = useMemo(
    () => DATA_COLUMNS.filter((c) => rows.some((r) => { const v = c.getValue(r); return v && String(v).trim(); })),
    [rows]
  );
  const anyHasResume = useMemo(() => rows.some((r) => r.has_resume), [rows]);

  const columns = [
    { key: "name", ar: "الاسم", en: "Name" },
    ...visibleDataColumns,
    { key: "contact", ar: "بيانات الاتصال", en: "Contact Info" },
    { key: "revealed_at", ar: "تاريخ الكشف", en: "Revealed On" },
    ...(anyHasResume ? [{ key: "cv", ar: "السيرة الذاتية", en: "Résumé" }] : []),
  ];

  if (isLoading) {
    return (
      <div dir={ar ? "rtl" : "ltr"} className="w-full overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key}>{ar ? c.ar : c.en}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((c) => (
                  <TableCell key={c.key}>
                    <Skeleton className="h-4 w-full max-w-[140px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        dir={ar ? "rtl" : "ltr"}
        className="flex flex-col items-center justify-center gap-3 rounded-md border py-16 text-center text-muted-foreground"
      >
        <SearchX className="h-10 w-10 opacity-50" />
        <p className="text-sm">
          {ar ? "ما كشفت بيانات أي مرشح بعد" : "You haven't revealed any candidates yet"}
        </p>
      </div>
    );
  }

  return (
    <div dir={ar ? "rtl" : "ltr"} className="w-full overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key}>{ar ? c.ar : c.en}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{dash(row.full_name)}</TableCell>
              {visibleDataColumns.map((c) => (
                <TableCell key={c.key}>{dash(c.getValue(row))}</TableCell>
              ))}
              <TableCell>
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span dir="ltr">{dash(row.phone)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span dir="ltr">{dash(row.email)}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(row.revealed_at).toLocaleDateString(ar ? "ar-SA" : "en-US")}
              </TableCell>
              {anyHasResume && (
                <TableCell>
                  {!row.has_resume ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : row.resume_url ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={row.resume_url} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-3.5 w-3.5 ms-1.5" />
                        {ar ? "عرض السيرة الذاتية" : "View résumé"}
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
