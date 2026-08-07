import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CheckSquare, ChevronLeft, ChevronRight, History, Loader2, LogOut, Save, Search, Trash2, Unlock, Wallet, X,
} from "lucide-react";
import {
  useClientSearchQuery,
  useBulkRevealCandidatesMutation,
  useClientRevealedCandidatesQuery,
  fetchClientFacets,
  type ClientFilterValue,
  type ClientFacetValue,
  type ClientSearchMode,
} from "@/hooks/queries/useClientPortalSearch";
import {
  useClientSavedFiltersQuery,
  useSaveClientFilterMutation,
  useDeleteClientSavedFilterMutation,
} from "@/hooks/queries/useClientSavedFilters";
import { queryKeys } from "@/lib/queryKeys";
import CategorizedFilterPanel, { type CategorizedFilterField } from "@/components/Dashboard/CategorizedFilterPanel";
import ClientResultsTable from "@/components/ClientPortal/ClientResultsTable";
import ClientRevealedCandidatesTable from "@/components/ClientPortal/ClientRevealedCandidatesTable";

// The same 19 fields the admin dashboard's ApplicantsAdvancedFilters exposes
// (and the only ones client-search-applicants/client-portal-facets allow-list),
// grouped into CategorizedFilterPanel's fixed 5-category taxonomy.
const CLIENT_PORTAL_FIELDS: CategorizedFilterField[] = [
  { key: "nationality", ar: "الجنسية", en: "Nationality", category: "personal" },
  { key: "gender", ar: "الجنس", en: "Gender", category: "personal" },
  { key: "marital_status", ar: "الحالة الاجتماعية", en: "Marital Status", category: "personal" },
  { key: "current_city", ar: "المدينة الحالية", en: "Current City", category: "personal" },
  { key: "preferred_city", ar: "المدينة المفضلة", en: "Preferred City", category: "personal" },
  { key: "has_transport", ar: "وسيلة نقل", en: "Has Transport", category: "personal" },
  { key: "desired_position", ar: "المسمى الوظيفي", en: "Desired Position", category: "experience" },
  { key: "job_type", ar: "نوع الوظيفة", en: "Job Type", category: "experience" },
  { key: "years_experience", ar: "سنوات الخبرة", en: "Years Experience", category: "experience" },
  { key: "current_title", ar: "المسمى الحالي", en: "Current Title", category: "experience" },
  { key: "currently_employed", ar: "موظف حالياً", en: "Currently Employed", category: "experience" },
  { key: "source", ar: "المصدر", en: "Source", category: "experience" },
  { key: "source_company", ar: "اسم الشركة المصدر", en: "Source Company", category: "experience" },
  { key: "education_level", ar: "المؤهل العلمي", en: "Education", category: "education" },
  { key: "major", ar: "التخصص", en: "Major", category: "education" },
  { key: "university", ar: "الجامعة", en: "University", category: "education" },
  { key: "arabic_level", ar: "اللغة العربية", en: "Arabic Level", category: "languages" },
  { key: "english_level", ar: "اللغة الإنجليزية", en: "English Level", category: "languages" },
  { key: "hear_about", ar: "كيف سمع عنا", en: "Heard About Us", category: "additional" },
];

export default function ClientPortalPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchMode, setSearchMode] = useState<ClientSearchMode>("any");
  const [filters, setFilters] = useState<ClientFilterValue[]>([]);
  const [page, setPage] = useState(1);
  const [facetsTick, setFacetsTick] = useState(0);

  // Debounce free-text search so every keystroke doesn't fire a network request.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset back to page 1 whenever the effective query (search, mode, or any filter) changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, searchMode, filters]);

  const { data, isLoading, isFetching } = useClientSearchQuery(filters, debouncedSearch, page, lang, searchMode);

  // ---- Bulk selection (scoped to the current page only -- resets whenever
  // the page or the underlying result set changes, so a selection never
  // silently refers to rows the user can no longer see). ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, debouncedSearch, searchMode, filters]);

  const bulkRevealMutation = useBulkRevealCandidatesMutation(lang);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  // Faceted distinct-value counts per field, scoped by every OTHER active
  // filter. CategorizedFilterPanel's getDistinctValues contract is
  // synchronous, so this returns whatever's already cached (possibly stale,
  // possibly nothing yet) immediately for a snappy UI, while ALWAYS also
  // calling fetchClientFacets -- that goes through queryClient.fetchQuery,
  // which is staleTime-aware and only actually hits the network when the
  // cached entry (including one rehydrated from the persisted IndexedDB
  // cache from a previous session) is stale. Do NOT short-circuit on "cache
  // has *some* value" the way an earlier version of this did: that served
  // permanently-stale counts forever after a server-side facets fix shipped,
  // since a plain page reload rehydrates the old persisted entry and nothing
  // ever re-triggers a revalidation for it otherwise.
  const getDistinctValues = useCallback(
    (field: string) => {
      const otherFilters = filters.filter((f) => f.field !== field);
      const key = queryKeys.clientPortal.facets(field, otherFilters);
      const cached = queryClient.getQueryData<ClientFacetValue[]>(key);
      // fetchQuery resolves with the SAME reference already in cache when
      // the entry is still fresh (no network call made) -- only bump
      // facetsTick when a real refetch actually changed the data, or this
      // would re-trigger itself forever (bump -> re-render -> effect fires
      // -> calls this again -> bump...).
      fetchClientFacets(queryClient, field, otherFilters, lang).then((fresh) => {
        if (fresh !== cached) setFacetsTick((t) => t + 1);
      });
      return cached || [];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, queryClient, lang, facetsTick]
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const creditsRemaining = data?.credits_remaining;
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const revealedOnPage = rows.filter((r) => r.is_revealed).length;
  const selectedRows = rows.filter((r) => selectedIds.has(r.id));
  const selectedUnrevealedCount = selectedRows.filter((r) => !r.is_revealed).length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allSelected = rows.length > 0 && rows.every((r) => prev.has(r.id));
      return allSelected ? new Set() : new Set(rows.map((r) => r.id));
    });
  };

  const confirmBulkReveal = () => {
    setBulkConfirmOpen(false);
    bulkRevealMutation.mutate([...selectedIds], { onSuccess: () => setSelectedIds(new Set()) });
  };

  const hasActiveFilters = filters.length > 0 || debouncedSearch.length > 0;

  const clearFilters = () => {
    setSearchInput("");
    setFilters([]);
  };

  // ---- Saved filters ----
  const { data: savedFilters = [] } = useClientSavedFiltersQuery();
  const saveFilterMutation = useSaveClientFilterMutation(lang);
  const deleteSavedFilterMutation = useDeleteClientSavedFilterMutation(lang);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");

  const openSaveDialog = () => {
    setSaveFilterName("");
    setSaveDialogOpen(true);
  };

  const submitSaveFilter = () => {
    if (!saveFilterName.trim()) return;
    saveFilterMutation.mutate(
      { name: saveFilterName.trim(), filters, search: debouncedSearch, search_mode: searchMode, result_count: total },
      { onSuccess: () => setSaveDialogOpen(false) }
    );
  };

  const applySavedFilter = (saved: (typeof savedFilters)[number]) => {
    setFilters(saved.filters);
    setSearchInput(saved.search);
    setDebouncedSearch(saved.search);
    setSearchMode(saved.search_mode);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/client-portal/login");
  };

  // ---- "المرشحين المكشوفين" tab: the org's full reveal history, independent
  // of the search tab's current filters/page. ----
  const [activeTab, setActiveTab] = useState<"search" | "revealed">("search");
  const [revealedPage, setRevealedPage] = useState(1);
  const { data: revealedData, isLoading: revealedLoading } = useClientRevealedCandidatesQuery(revealedPage, lang);
  const revealedRows = revealedData?.rows ?? [];
  const revealedTotal = revealedData?.total ?? 0;
  const revealedTotalPages = Math.max(1, Math.ceil(revealedTotal / 20));

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

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "search" | "revealed")} className="mb-4">
          <TabsList>
            <TabsTrigger value="search" className="gap-1.5">
              <Search className="h-3.5 w-3.5" />
              {ar ? "البحث" : "Search"}
            </TabsTrigger>
            <TabsTrigger value="revealed" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              {ar ? "المرشحين المكشوفين" : "Revealed Candidates"}
              {revealedTotal > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{revealedTotal}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "revealed" ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {ar ? `المرشحين المكشوفين (${revealedTotal})` : `Revealed Candidates (${revealedTotal})`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ClientRevealedCandidatesTable lang={lang} rows={revealedRows} isLoading={revealedLoading} />

              {revealedTotal > 0 && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-sm text-muted-foreground">
                    {ar ? `الصفحة ${revealedPage} من ${revealedTotalPages}` : `Page ${revealedPage} of ${revealedTotalPages}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={revealedPage <= 1}
                      onClick={() => setRevealedPage((p) => Math.max(1, p - 1))}
                    >
                      {ar ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      {ar ? "السابق" : "Previous"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={revealedPage >= revealedTotalPages}
                      onClick={() => setRevealedPage((p) => Math.min(revealedTotalPages, p + 1))}
                    >
                      {ar ? "التالي" : "Next"}
                      {ar ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
          <Card className="lg:sticky lg:top-[73px] lg:h-[calc(100vh-90px)] lg:overflow-hidden">
            <CardContent className="pt-4 h-full overflow-hidden">
              <CategorizedFilterPanel
                fields={CLIENT_PORTAL_FIELDS}
                lang={lang}
                filters={filters}
                setFilters={setFilters}
                getDistinctValues={getDistinctValues}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={ar ? "ابحث بالاسم، المسمى الوظيفي، التخصص..." : "Search by name, job title, major..."}
                    className="ps-9"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {ar ? "نمط البحث:" : "Search mode:"}
                  </span>
                  <ToggleGroup
                    type="single"
                    size="sm"
                    value={searchMode}
                    onValueChange={(v) => v && setSearchMode(v as ClientSearchMode)}
                  >
                    <ToggleGroupItem value="any" className="text-xs px-3">
                      {ar ? "أي كلمة" : "Any words"}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="all" className="text-xs px-3">
                      {ar ? "كل الكلمات" : "All words"}
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openSaveDialog}
                    disabled={!hasActiveFilters}
                    className={hasActiveFilters ? "ms-auto" : "ms-auto opacity-60"}
                  >
                    <Save className="h-3.5 w-3.5 ms-1.5" />
                    {ar ? "حفظ الفلتر الحالي" : "Save current filter"}
                  </Button>

                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-3.5 w-3.5 ms-1.5" />
                      {ar ? "مسح الكل" : "Clear all"}
                    </Button>
                  )}
                </div>

                {savedFilters.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
                    <span className="text-xs text-muted-foreground shrink-0">
                      {ar ? "الفلاتر المحفوظة:" : "Saved filters:"}
                    </span>
                    {savedFilters.map((saved) => (
                      <Badge
                        key={saved.id}
                        variant="outline"
                        className="gap-1 pe-1 cursor-pointer hover:bg-muted font-normal"
                        onClick={() => applySavedFilter(saved)}
                      >
                        <span>{saved.name}</span>
                        {typeof saved.result_count === "number" && (
                          <span className="text-muted-foreground">({saved.result_count})</span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSavedFilterMutation.mutate(saved.id);
                          }}
                          className="hover:bg-destructive/20 rounded p-0.5"
                          aria-label={ar ? "حذف" : "Delete"}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">
                    {ar ? `النتائج (${total})` : `Results (${total})`}
                  </CardTitle>
                  {!isLoading && rows.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {ar
                        ? `معروض ${rows.length} بهذه الصفحة — ${revealedOnPage} مكشوف، ${rows.length - revealedOnPage} غير مكشوف`
                        : `Showing ${rows.length} on this page — ${revealedOnPage} revealed, ${rows.length - revealedOnPage} locked`}
                    </p>
                  )}
                </div>
                {isFetching && !isLoading && (
                  <span className="text-xs text-muted-foreground">{ar ? "جارِ التحديث..." : "Updating..."}</span>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedIds.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                    <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm">
                      {ar ? `تم تحديد ${selectedIds.size} مرشح` : `${selectedIds.size} candidates selected`}
                    </span>
                    <Button
                      size="sm"
                      className="ms-auto gap-1"
                      disabled={bulkRevealMutation.isPending}
                      onClick={() => setBulkConfirmOpen(true)}
                    >
                      {bulkRevealMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unlock className="h-3.5 w-3.5" />
                      )}
                      {ar ? "كشف المحدد" : "Reveal selected"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                      {ar ? "إلغاء التحديد" : "Clear selection"}
                    </Button>
                  </div>
                )}

                <ClientResultsTable
                  lang={lang}
                  rows={rows}
                  isLoading={isLoading}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onToggleSelectAll={toggleSelectAll}
                />

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
          </div>
        </div>
        )}
      </main>

      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{ar ? "تأكيد الكشف الجماعي" : "Confirm bulk reveal"}</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2">
            <p>
              {ar
                ? `حددت ${selectedIds.size} مرشح.`
                : `You selected ${selectedIds.size} candidates.`}
            </p>
            <p>
              {selectedUnrevealedCount > 0
                ? ar
                  ? `سيُخصم ${selectedUnrevealedCount} رصيد كشف (${selectedIds.size - selectedUnrevealedCount} منهم مكشوفون مسبقاً، بدون خصم إضافي).`
                  : `${selectedUnrevealedCount} credits will be spent (${selectedIds.size - selectedUnrevealedCount} already revealed, no extra charge).`
                : ar
                ? "كل المحدد مكشوف مسبقاً — ما راح يُخصم أي رصيد."
                : "Everything selected is already revealed -- no credits will be spent."}
            </p>
            {typeof creditsRemaining === "number" && selectedUnrevealedCount > creditsRemaining && (
              <p className="text-destructive">
                {ar
                  ? `رصيدك الحالي (${creditsRemaining}) أقل من المطلوب — سيتم كشف أول ${creditsRemaining} فقط.`
                  : `Your balance (${creditsRemaining}) is less than needed -- only the first ${creditsRemaining} will be revealed.`}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={confirmBulkReveal} disabled={bulkRevealMutation.isPending}>
              {bulkRevealMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ms-1.5" />}
              {ar ? "تأكيد الكشف" : "Confirm reveal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{ar ? "حفظ الفلتر الحالي" : "Save current filter"}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={saveFilterName}
            onChange={(e) => setSaveFilterName(e.target.value)}
            placeholder={ar ? "اسم الفلتر (مثال: مرشحين رياض بخبرة 3-5)" : "Filter name (e.g. Riyadh, 3-5 yrs exp)"}
            onKeyDown={(e) => e.key === "Enter" && submitSaveFilter()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={submitSaveFilter} disabled={!saveFilterName.trim() || saveFilterMutation.isPending}>
              {saveFilterMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ms-1.5" />}
              {ar ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
