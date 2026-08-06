import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, LogOut, Search, Wallet, X } from "lucide-react";
import { getNationalities, getSaudiCities, getEducationLevels, getJobPositions, getYearsOfExperience } from "@/data/jobPositions";
import { useClientSearchQuery, type ClientFilterValue } from "@/hooks/queries/useClientPortalSearch";
import ClientResultsTable from "@/components/ClientPortal/ClientResultsTable";

const ALL = "__all__"; // sentinel for the "no filter" option — Radix <Select> rejects an empty-string value

// The MVP filter set: a handful of the most-searched fields as plain <Select>s.
// Options come from the same static bilingual lists used on the public application
// form (src/data/jobPositions.ts) rather than a server-aggregated distinct-values
// endpoint — the search edge function doesn't expose one yet. A follow-up pass
// swaps this whole panel for <CategorizedFilterPanel> once it does.
function useFilterFieldDefs(lang: "ar" | "en") {
  return useMemo(
    () => [
      { key: "nationality", ar: "الجنسية", en: "Nationality", options: getNationalities(lang) },
      { key: "desired_position", ar: "الوظيفة المطلوبة", en: "Desired Position", options: getJobPositions(lang) },
      { key: "preferred_city", ar: "المدينة المفضلة", en: "Preferred City", options: getSaudiCities(lang) },
      { key: "education_level", ar: "المؤهل العلمي", en: "Education Level", options: getEducationLevels(lang) },
      { key: "years_experience", ar: "سنوات الخبرة", en: "Years of Experience", options: getYearsOfExperience(lang) },
    ],
    [lang]
  );
}

export default function ClientPortalPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const filterFieldDefs = useFilterFieldDefs(lang);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectValues, setSelectValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  // Debounce free-text search so every keystroke doesn't fire a network request.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset back to page 1 whenever the effective query (search or any filter) changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectValues]);

  const filters: ClientFilterValue[] = useMemo(
    () =>
      Object.entries(selectValues)
        .filter(([, value]) => value && value !== ALL)
        .map(([field, value]) => ({ field, value })),
    [selectValues]
  );

  const { data, isLoading, isFetching } = useClientSearchQuery(filters, debouncedSearch, page, lang);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const creditsRemaining = data?.credits_remaining;
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const hasActiveFilters = filters.length > 0 || debouncedSearch.length > 0;

  const clearFilters = () => {
    setSearchInput("");
    setSelectValues({});
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/client-portal/login");
  };

  return (
    <div dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg font-semibold">
            {ar ? "بوابة البحث عن المرشحين" : "Candidate Search Portal"}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 py-1.5 text-sm font-normal">
              <Wallet className="h-3.5 w-3.5" />
              {typeof creditsRemaining === "number"
                ? ar
                  ? `الرصيد: ${creditsRemaining} كشف متبقي`
                  : `Balance: ${creditsRemaining} reveals left`
                : ar
                ? "الرصيد: —"
                : "Balance: —"}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 ms-1.5" />
              {ar ? "تسجيل الخروج" : "Logout"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{ar ? "بحث وتصفية" : "Search & Filters"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={ar ? "ابحث بالاسم، المسمى الوظيفي..." : "Search by name, job title..."}
                className="ps-9"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {filterFieldDefs.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{ar ? field.ar : field.en}</Label>
                  <Select
                    value={selectValues[field.key] ?? ALL}
                    onValueChange={(value) =>
                      setSelectValues((prev) => ({ ...prev, [field.key]: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={ar ? "الكل" : "All"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{ar ? "الكل" : "All"}</SelectItem>
                      {field.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5 ms-1.5" />
                {ar ? "مسح الفلاتر" : "Clear filters"}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              {ar ? `النتائج (${total})` : `Results (${total})`}
            </CardTitle>
            {isFetching && !isLoading && (
              <span className="text-xs text-muted-foreground">{ar ? "جارِ التحديث..." : "Updating..."}</span>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <ClientResultsTable lang={lang} rows={rows} isLoading={isLoading} />

            {total > 0 && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-sm text-muted-foreground">
                  {ar ? `الصفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {ar ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    {ar ? "السابق" : "Previous"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    {ar ? "التالي" : "Next"}
                    {ar ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
