// AI Filter Builder dialog — convert a natural-language description into structured filters
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, X, Wand2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AdvancedFilter } from "./ApplicantsAdvancedFilters";

interface Props {
  applicants: any[];
  lang: "ar" | "en";
  onApply: (filters: AdvancedFilter[]) => void;
  currentFilters: AdvancedFilter[];
}

type Suggested = { field: string; value: string; reason: string };

const FIELDS = [
  "nationality","desired_position","preferred_city","current_city","gender","marital_status",
  "education_level","major","university","job_type","years_experience","current_title",
  "currently_employed","has_transport","arabic_level","english_level","hear_about","source","source_company",
];

const fieldLabels: Record<string, { ar: string; en: string }> = {
  nationality: { ar: "الجنسية", en: "Nationality" },
  desired_position: { ar: "المسمى الوظيفي", en: "Desired Position" },
  preferred_city: { ar: "المدينة المفضلة", en: "Preferred City" },
  current_city: { ar: "المدينة الحالية", en: "Current City" },
  gender: { ar: "الجنس", en: "Gender" },
  marital_status: { ar: "الحالة الاجتماعية", en: "Marital Status" },
  education_level: { ar: "المؤهل", en: "Education" },
  major: { ar: "التخصص", en: "Major" },
  university: { ar: "الجامعة", en: "University" },
  job_type: { ar: "نوع الوظيفة", en: "Job Type" },
  years_experience: { ar: "سنوات الخبرة", en: "Experience" },
  current_title: { ar: "المسمى الحالي", en: "Current Title" },
  currently_employed: { ar: "موظف حالياً", en: "Employed" },
  has_transport: { ar: "وسيلة نقل", en: "Transport" },
  arabic_level: { ar: "العربية", en: "Arabic" },
  english_level: { ar: "الإنجليزية", en: "English" },
  hear_about: { ar: "سمع عنا", en: "Heard About" },
  source: { ar: "المصدر", en: "Source" },
  source_company: { ar: "شركة المصدر", en: "Source Co." },
};

export default function AiFilterBuilder({ applicants, lang, onApply, currentFilters }: Props) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState<Suggested[]>([]);
  const [summary, setSummary] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const fieldLabel = (k: string) => fieldLabels[k]?.[lang] || k;

  const run = async () => {
    if (!description.trim()) {
      toast.error(lang === "ar" ? "اكتب وصفاً" : "Enter a description");
      return;
    }
    setLoading(true);
    try {
      // Build distinct-values catalog from current data
      const catalog: Record<string, string[]> = {};
      for (const f of FIELDS) {
        const set = new Set<string>();
        for (const a of applicants) {
          const v = a[f];
          if (v != null && String(v).trim()) set.add(String(v).trim());
        }
        catalog[f] = Array.from(set);
      }
      const { data, error } = await supabase.functions.invoke("ai-build-filters", {
        body: { description, lang, distinct_values: catalog },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const filters: Suggested[] = Array.isArray(data?.filters) ? data.filters : [];
      setSuggested(filters);
      setSummary(data?.summary || "");
      setPicked(new Set(filters.map((_, i) => i))); // all picked by default
      if (filters.length === 0) {
        toast.info(lang === "ar" ? "لم يجد فلاتر مناسبة من البيانات الموجودة" : "No matching filters found in data");
      } else {
        toast.success(lang === "ar" ? `اقترح ${filters.length} فلتر` : `Suggested ${filters.length} filters`);
      }
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i: number) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const apply = (mode: "replace" | "add") => {
    const selected = suggested.filter((_, i) => picked.has(i)).map(s => ({ field: s.field, value: s.value }));
    if (selected.length === 0) return;
    if (mode === "replace") {
      onApply(selected);
    } else {
      const existing = new Set(currentFilters.map(f => `${f.field}::${f.value}`));
      const merged = [...currentFilters];
      for (const s of selected) if (!existing.has(`${s.field}::${s.value}`)) merged.push(s);
      onApply(merged);
    }
    toast.success(lang === "ar" ? `طُبّق ${selected.length} فلتر` : `Applied ${selected.length} filters`);
    setOpen(false);
    setDescription(""); setSuggested([]); setPicked(new Set()); setSummary("");
  };

  // Group suggestions by field for display
  const byField = new Map<string, { item: Suggested; idx: number }[]>();
  suggested.forEach((s, i) => {
    const arr = byField.get(s.field) || [];
    arr.push({ item: s, idx: i });
    byField.set(s.field, arr);
  });

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-1 border-accent text-accent hover:bg-accent hover:text-accent-foreground"
      >
        <Wand2 className="w-4 h-4" />
        {lang === "ar" ? "اكتب فلتر بالذكاء" : "Smart Filter Builder"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              {lang === "ar" ? "بناء فلتر ذكي" : "Smart Filter Builder"}
            </DialogTitle>
            <DialogDescription>
              {lang === "ar"
                ? "اكتب وصفاً نصياً للمرشحين الذين تريدهم. الذكاء الاصطناعي سيحوّله إلى فلاتر دقيقة بناءً على البيانات الفعلية الموجودة. يمكنك مراجعتها قبل التطبيق."
                : "Describe the candidates you want. AI converts it into precise filters based on actual data. Review before applying."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              rows={3}
              placeholder={lang === "ar"
                ? "مثال: محاسبون سعوديون في الرياض بكالوريوس محاسبة خبرة 3+ سنوات"
                : "e.g. Saudi accountants in Riyadh, Bachelor in Accounting, 3+ years experience"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={run} disabled={loading} className="gap-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {lang === "ar" ? "حلّل واقترح" : "Analyze"}
              </Button>
              {suggested.length > 0 && (
                <Button variant="ghost" onClick={() => { setSuggested([]); setPicked(new Set()); setSummary(""); }}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {suggested.length > 0 && (
            <>
              {summary && (
                <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded border">{summary}</div>
              )}
              <ScrollArea className="flex-1 max-h-[50vh] pr-2">
                <div className="space-y-3">
                  {Array.from(byField.entries()).map(([field, items]) => (
                    <div key={field} className="border rounded-md p-2.5 bg-card">
                      <div className="text-xs font-semibold text-accent mb-2">{fieldLabel(field)}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map(({ item, idx }) => {
                          const isPicked = picked.has(idx);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => toggle(idx)}
                              className={`text-xs px-2 py-1 rounded border transition flex items-center gap-1 ${
                                isPicked
                                  ? "bg-accent text-accent-foreground border-accent"
                                  : "bg-background hover:bg-muted border-border"
                              }`}
                              title={item.reason}
                            >
                              {isPicked && <Check className="w-3 h-3" />}
                              {item.value}
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {items[0]?.item.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                  {lang === "ar" ? `محدد: ${picked.size} من ${suggested.length}` : `${picked.size}/${suggested.length} selected`}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => apply("add")} disabled={picked.size === 0}>
                    {lang === "ar" ? "إضافة للفلاتر الحالية" : "Add to current"}
                  </Button>
                  <Button onClick={() => apply("replace")} disabled={picked.size === 0} className="gap-1">
                    <Check className="w-4 h-4" />
                    {lang === "ar" ? "تطبيق (استبدال)" : "Apply (replace)"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
