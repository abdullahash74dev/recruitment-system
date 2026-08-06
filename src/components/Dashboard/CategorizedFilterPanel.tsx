import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ChevronDown, ChevronUp, Search, Sparkles, X, XCircle } from "lucide-react";

export interface CategorizedFilterField {
  key: string;
  ar: string;
  en: string;
  category: string;
}

export interface CategorizedFilterValue {
  field: string;
  value: string;
}

// A distinct-value entry from getDistinctValues(). `value` is what's actually
// stored in filters/sent to the backend (may be an opaque encoded key, e.g. a
// canonical synonym-group token) -- `label` is what's shown to the user, and
// defaults to `value` when omitted. `isGroup` marks a synonym-group entry
// (multiple raw values collapsed into one canonical match) for a small visual
// hint, distinguishing it from a literal single-value match.
export interface DistinctValueEntry {
  value: string;
  count: number;
  label?: string;
  isGroup?: boolean;
}

interface CategorizedFilterPanelProps {
  fields: CategorizedFilterField[];
  lang: "ar" | "en";
  filters: CategorizedFilterValue[];
  setFilters: (f: CategorizedFilterValue[]) => void;
  getDistinctValues: (field: string) => DistinctValueEntry[];
  locked?: boolean;
}

// Category metadata: exact keys + bilingual labels + field membership, per spec.
const CATEGORY_ORDER = ["personal", "experience", "education", "languages", "additional"] as const;
type CategoryKey = (typeof CATEGORY_ORDER)[number];

const CATEGORY_LABELS: Record<CategoryKey, { ar: string; en: string }> = {
  personal: { ar: "المعلومات الشخصية", en: "Personal Information" },
  experience: { ar: "الخبرة العملية", en: "Work Experience" },
  education: { ar: "التعليم", en: "Education" },
  languages: { ar: "اللغات", en: "Languages" },
  additional: { ar: "معلومات إضافية", en: "Additional Information" },
};

export default function CategorizedFilterPanel({
  fields, lang, filters, setFilters, getDistinctValues, locked,
}: CategorizedFilterPanelProps) {
  const ar = lang === "ar";
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchByField, setSearchByField] = useState<Record<string, string>>({});

  // Group the caller-supplied fields into the fixed category order. Any field whose
  // category doesn't match a known key falls back to "additional" so nothing is dropped.
  const fieldsByCategory = useMemo(() => {
    const map = new Map<CategoryKey, CategoryFieldsEntry>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const f of fields) {
      const cat = (CATEGORY_ORDER as readonly string[]).includes(f.category) ? (f.category as CategoryKey) : "additional";
      map.get(cat)!.push(f);
    }
    return map;
  }, [fields]);

  // Applied-value lookup: field -> Set of applied values, for quick membership checks
  // when rendering checkboxes and chips.
  const appliedByField = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const f of filters) {
      const set = map.get(f.field) || new Set<string>();
      set.add(f.value);
      map.set(f.field, set);
    }
    return map;
  }, [filters]);

  // Count of applied filters per category, shown as a badge on each AccordionTrigger.
  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of CATEGORY_ORDER) counts[cat] = 0;
    for (const f of filters) {
      const field = fields.find((x) => x.key === f.field);
      const cat = field && (CATEGORY_ORDER as readonly string[]).includes(field.category) ? field.category : "additional";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [filters, fields]);

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleValue = (field: string, value: string) => {
    const already = filters.some((f) => f.field === field && f.value === value);
    if (already) {
      setFilters(filters.filter((f) => !(f.field === field && f.value === value)));
    } else {
      setFilters([...filters, { field, value }]);
    }
  };

  const removeValue = (field: string, value: string) => {
    setFilters(filters.filter((f) => !(f.field === field && f.value === value)));
  };

  const clearAll = () => setFilters([]);

  const totalApplied = filters.length;

  return (
    <div dir={ar ? "rtl" : "ltr"} className="w-full">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <div className="text-sm font-semibold">
          {ar ? "الفلاتر" : "Filters"}
          {totalApplied > 0 && (
            <Badge variant="secondary" className="ms-2 text-[10px] h-5">{totalApplied}</Badge>
          )}
        </div>
        {totalApplied > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1 h-7 text-xs" disabled={locked}>
            <XCircle className="w-3.5 h-3.5" />
            {ar ? "مسح الكل" : "Clear all"}
          </Button>
        )}
      </div>

      <ScrollArea className="max-h-[70vh] pe-2">
        <Accordion type="multiple" className="w-full space-y-2" defaultValue={[...CATEGORY_ORDER]}>
          {CATEGORY_ORDER.map((cat) => {
            const catFields = fieldsByCategory.get(cat) || [];
            if (catFields.length === 0) return null;
            const catCount = countByCategory[cat] || 0;
            const label = ar ? CATEGORY_LABELS[cat].ar : CATEGORY_LABELS[cat].en;

            return (
              <AccordionItem key={cat} value={cat} className="border rounded-lg px-2 bg-card">
                <AccordionTrigger className="hover:no-underline py-2.5 text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <span>{label}</span>
                    {catCount > 0 && (
                      <Badge variant="default" className="text-[10px] h-5 px-1.5">{catCount}</Badge>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <div className="space-y-1">
                    {catFields.map((field) => (
                      <FieldRow
                        key={field.key}
                        field={field}
                        ar={ar}
                        locked={locked}
                        isExpanded={expanded.has(field.key)}
                        onToggleExpanded={() => toggleExpanded(field.key)}
                        applied={appliedByField.get(field.key) || new Set()}
                        onRemoveValue={(v) => removeValue(field.key, v)}
                        onToggleValue={(v) => toggleValue(field.key, v)}
                        search={searchByField[field.key] || ""}
                        onSearchChange={(v) => setSearchByField((prev) => ({ ...prev, [field.key]: v }))}
                        getDistinctValues={getDistinctValues}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>
    </div>
  );
}

type CategoryFieldsEntry = CategorizedFilterField[];

interface FieldRowProps {
  field: CategorizedFilterField;
  ar: boolean;
  locked?: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  applied: Set<string>;
  onRemoveValue: (value: string) => void;
  onToggleValue: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  getDistinctValues: (field: string) => DistinctValueEntry[];
}

function FieldRow({
  field, ar, locked, isExpanded, onToggleExpanded, applied, onRemoveValue, onToggleValue,
  search, onSearchChange, getDistinctValues,
}: FieldRowProps) {
  const fieldLabel = ar ? field.ar : field.en;

  // Only compute distinct values while the row is expanded — getDistinctValues may be
  // an expensive scan/aggregate on the caller's side, so avoid running it for every
  // collapsed field on every render. Kept in state (not reset to [] on collapse) so
  // the applied-chips row below can still resolve a human label for a value applied
  // while the row was previously open, instead of falling back to its raw token.
  const [distinct, setDistinct] = useState<DistinctValueEntry[]>([]);
  useEffect(() => {
    if (isExpanded) setDistinct(getDistinctValues(field.key));
  }, [isExpanded, getDistinctValues, field.key]);

  const labelByValue = useMemo(() => {
    const map = new Map<string, DistinctValueEntry>();
    for (const d of distinct) map.set(d.value, d);
    return map;
  }, [distinct]);

  const filteredDistinct = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...distinct].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    if (!q) return sorted;
    return sorted.filter((d) => (d.label ?? d.value).toLowerCase().includes(q));
  }, [distinct, search]);

  return (
    <div className="rounded-md border border-transparent hover:border-border transition-colors">
      <button
        type="button"
        onClick={onToggleExpanded}
        disabled={locked}
        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-start text-sm rounded-md hover:bg-muted disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-1.5">
          <span>{fieldLabel}</span>
          {applied.size > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1">{applied.size}</Badge>
          )}
        </span>
        {isExpanded ? <ChevronUp className="w-4 h-4 opacity-60 shrink-0" /> : <ChevronDown className="w-4 h-4 opacity-60 shrink-0" />}
      </button>

      {applied.size > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pb-1.5 ps-4">
          {Array.from(applied).map((v) => (
            <Badge key={v} variant="outline" className="gap-1 pe-1 text-[11px] font-normal">
              {labelByValue.get(v)?.isGroup && <Sparkles className="w-3 h-3 shrink-0 opacity-70" />}
              <span className="truncate max-w-[160px]">{labelByValue.get(v)?.label ?? v}</span>
              <button
                type="button"
                onClick={() => onRemoveValue(v)}
                disabled={locked}
                className="hover:bg-destructive/20 rounded p-0.5 disabled:pointer-events-none"
                aria-label={ar ? "إزالة" : "Remove"}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {isExpanded && (
        <div className="px-2 pb-2 ps-4 space-y-1.5">
          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 start-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={ar ? "بحث..." : "Search..."}
              className="h-8 ps-7 text-xs"
              disabled={locked}
            />
          </div>
          <ScrollArea className="max-h-[220px] rounded border bg-background/50">
            <div className="p-1">
              {filteredDistinct.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  {ar ? "لا توجد قيم" : "No values"}
                </div>
              ) : (
                filteredDistinct.map((d) => {
                  const checked = applied.has(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      disabled={locked}
                      onClick={() => onToggleValue(d.value)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-start text-xs disabled:cursor-not-allowed"
                    >
                      <Checkbox checked={checked} className="pointer-events-none shrink-0" />
                      {d.isGroup && <Sparkles className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                      <span className="flex-1 truncate">{d.label ?? d.value}</span>
                      <Badge variant="secondary" className="text-[10px] h-5 shrink-0">{d.count}</Badge>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
