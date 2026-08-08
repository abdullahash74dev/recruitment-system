import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, CheckCircle2 } from "lucide-react";
import { useClientFacetsQuery, type ClientFilterValue, type ClientSearchMode } from "@/hooks/queries/useClientPortalSearch";

interface ClientSearchStatsPanelProps {
  lang: "ar" | "en";
  filters: ClientFilterValue[];
  search: string;
  searchMode: ClientSearchMode;
  total: number;
  revealedInResults: number;
}

interface StatBlockProps {
  title: string;
  field: string;
  filters: ClientFilterValue[];
  search: string;
  searchMode: ClientSearchMode;
  lang: "ar" | "en";
  total: number;
}

/** One breakdown block (e.g. "Nationality"): top few distinct values as
 * percentage bars, reusing client-portal-facets -- the same faceted-count
 * endpoint the sidebar filter picker uses, just rendered as a summary
 * instead of a checkbox list. No new backend endpoint needed. */
function StatBlock({ title, field, filters, search, searchMode, lang, total }: StatBlockProps) {
  const ar = lang === "ar";
  const { data, isLoading } = useClientFacetsQuery(field, filters, search, searchMode, true, lang);
  const top = (data || []).slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    );
  }

  if (top.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-1">
        {top.map((v) => {
          const pct = total > 0 ? Math.round((v.count / total) * 100) : 0;
          return (
            <div key={v.value} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate">{v.label}</span>
                <span className="text-muted-foreground shrink-0 ms-2">
                  {ar ? `${v.count.toLocaleString("ar")} (${pct}%)` : `${v.count.toLocaleString()} (${pct}%)`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Live stats summary for the CURRENT search/filter set -- nationality,
 * gender, education, major, and city breakdowns, plus a revealed/total
 * ratio. Entirely built from the existing client-portal-facets endpoint;
 * no new backend surface except `revealed_in_results` on the search
 * response itself.
 */
export default function ClientSearchStatsPanel({
  lang, filters, search, searchMode, total, revealedInResults,
}: ClientSearchStatsPanelProps) {
  const ar = lang === "ar";
  const revealedPct = total > 0 ? Math.round((revealedInResults / total) * 100) : 0;

  const blocks = useMemo(
    () => [
      { field: "nationality", title: ar ? "الجنسية" : "Nationality" },
      { field: "gender", title: ar ? "الجنس" : "Gender" },
      { field: "education_level", title: ar ? "المؤهل العلمي" : "Education" },
      { field: "major", title: ar ? "أبرز التخصصات" : "Top Majors" },
      { field: "current_city", title: ar ? "أبرز المدن" : "Top Cities" },
      { field: "years_experience", title: ar ? "سنوات الخبرة" : "Years of Experience" },
    ],
    [ar]
  );

  if (total === 0) return null;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{ar ? "ملخّص النتائج" : "Results Summary"}</h3>
        </div>

        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 mb-4">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="text-sm">
            {ar
              ? `${revealedInResults} من ${total} مكشوف بهذه النتائج (${revealedPct}%)`
              : `${revealedInResults} of ${total} results revealed (${revealedPct}%)`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {blocks.map((b) => (
            <StatBlock
              key={b.field}
              title={b.title}
              field={b.field}
              filters={filters}
              search={search}
              searchMode={searchMode}
              lang={lang}
              total={total}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
