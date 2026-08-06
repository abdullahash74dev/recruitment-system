import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Lock, Unlock, Phone, Mail, SearchX, FileText } from "lucide-react";
import { useRevealCandidateMutation, type ClientApplicantRow } from "@/hooks/queries/useClientPortalSearch";

interface ClientResultsTableProps {
  lang: "ar" | "en";
  rows: ClientApplicantRow[];
  isLoading: boolean;
}

const dash = (v: string | null | undefined) => (v && v.trim() ? v : "—");

// Optional data columns -- hidden entirely (header + cells) when every row on
// the current page has nothing to show for them, so a page of results never
// drags along a wall of "—" cells for a field this batch of candidates just
// didn't fill in.
const DATA_COLUMNS: {
  key: string;
  ar: string;
  en: string;
  getValue: (row: ClientApplicantRow) => string | null | undefined;
}[] = [
  { key: "position", ar: "الوظيفة المطلوبة", en: "Desired Position", getValue: (r) => r.desired_position },
  { key: "nationality", ar: "الجنسية", en: "Nationality", getValue: (r) => r.nationality },
  { key: "city", ar: "المدينة", en: "City", getValue: (r) => r.preferred_city || r.current_city },
  { key: "education", ar: "المؤهل العلمي", en: "Education", getValue: (r) => r.education_level },
  { key: "experience", ar: "سنوات الخبرة", en: "Experience", getValue: (r) => r.years_experience },
];

/**
 * Results table for the client search portal. Purely presentational aside from
 * owning the reveal mutation itself (button + pending state) — display data comes
 * straight from `rows` as returned by the edge function, no client-side masking.
 * Takes `lang` as a prop rather than calling `useLanguage()` so it stays reusable
 * outside the language-context tree, same convention as CategorizedFilterPanel.
 */
export default function ClientResultsTable({ lang, rows, isLoading }: ClientResultsTableProps) {
  const ar = lang === "ar";
  const revealMutation = useRevealCandidateMutation(lang);
  const revealingId = revealMutation.isPending ? (revealMutation.variables as string) : null;

  const visibleDataColumns = useMemo(
    () => DATA_COLUMNS.filter((c) => rows.some((r) => { const v = c.getValue(r); return v && String(v).trim(); })),
    [rows]
  );
  const anyHasResume = useMemo(() => rows.some((r) => r.has_resume), [rows]);

  const columns = [
    { key: "name", ar: "الاسم", en: "Name" },
    ...visibleDataColumns,
    { key: "contact", ar: "بيانات الاتصال", en: "Contact Info" },
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
          {ar ? "لا توجد نتائج مطابقة لبحثك" : "No results match your search"}
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
          {rows.map((row) => {
            const isRevealing = revealingId === row.id;
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{dash(row.full_name)}</TableCell>
                {visibleDataColumns.map((c) => (
                  <TableCell key={c.key}>{dash(c.getValue(row))}</TableCell>
                ))}
                <TableCell>
                  {row.is_revealed ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Unlock className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <Badge variant="outline" className="border-emerald-600/40 text-emerald-600 text-[10px]">
                          {ar ? "مكشوف" : "Unlocked"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span dir="ltr">{dash(row.phone)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span dir="ltr">{dash(row.email)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        <span dir="ltr">{dash(row.phone)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span dir="ltr">{dash(row.email)}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-fit"
                        disabled={isRevealing}
                        onClick={() => revealMutation.mutate(row.id)}
                      >
                        {isRevealing ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin ms-1.5" />
                            {ar ? "جارِ الكشف..." : "Revealing..."}
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3.5 w-3.5 ms-1.5" />
                            {ar ? "كشف البيانات" : "Reveal"}
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </TableCell>
                {anyHasResume && (
                  <TableCell>
                    {!row.has_resume ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : row.is_revealed && row.resume_url ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={row.resume_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-3.5 w-3.5 ms-1.5" />
                          {ar ? "عرض السيرة الذاتية" : "View résumé"}
                        </a>
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        {ar ? "بعد الكشف" : "After reveal"}
                      </span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
