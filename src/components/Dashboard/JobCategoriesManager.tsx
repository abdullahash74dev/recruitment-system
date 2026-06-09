// JobCategoriesManager — manage categories + categorize all unique job titles in the system
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Sparkles, Plus, Trash2, FolderTree, ArrowDownAZ, Save, Edit3 } from "lucide-react";

type Category = { id: string; name_ar: string; name_en: string | null; color: string | null; sort_order: number };
type TitleRow = { title_normalized: string; title_display: string; count: number; category_id: string | null };

const normTitle = (s: string) =>
  String(s || "").trim().toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/\s+/g, " ").trim();

export default function JobCategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("__all__");
  const [newCatAr, setNewCatAr] = useState("");
  const [newCatEn, setNewCatEn] = useState("");
  const [pendingChanges, setPendingChanges] = useState<Map<string, string | null>>(new Map());
  const [groupByCategory, setGroupByCategory] = useState(false);

  const load = async () => {
    setLoading(true);
    const [catsRes, mapRes, appsRes, recRes] = await Promise.all([
      supabase.from("job_categories").select("*").order("sort_order"),
      supabase.from("job_title_categories").select("*"),
      supabase.from("applicants").select("desired_position").limit(10000),
      supabase.from("recruitment_job_titles").select("title_ar"),
    ]);
    setCategories((catsRes.data || []) as Category[]);
    const mapByNorm = new Map<string, string | null>();
    (mapRes.data || []).forEach((m: any) => mapByNorm.set(m.title_normalized, m.category_id));

    // Aggregate titles from applicants + recruitment_job_titles
    const agg = new Map<string, { display: string; count: number }>();
    const consume = (raw: string | null | undefined) => {
      if (!raw) return;
      const t = String(raw).trim();
      if (!t) return;
      const n = normTitle(t);
      if (!n) return;
      const cur = agg.get(n);
      if (cur) cur.count++;
      else agg.set(n, { display: t, count: 1 });
    };
    (appsRes.data || []).forEach((r: any) => consume(r.desired_position));
    (recRes.data || []).forEach((r: any) => consume(r.title_ar));

    const rows: TitleRow[] = Array.from(agg.entries()).map(([n, v]) => ({
      title_normalized: n,
      title_display: v.display,
      count: v.count,
      category_id: mapByNorm.get(n) ?? null,
    }));
    rows.sort((a, b) => a.title_display.localeCompare(b.title_display, "ar"));
    setTitles(rows);
    setPendingChanges(new Map());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return titles.filter(t => {
      if (q && !t.title_display.toLowerCase().includes(q)) return false;
      if (filterCat !== "__all__") {
        const effective = pendingChanges.has(t.title_normalized) ? pendingChanges.get(t.title_normalized) : t.category_id;
        if (filterCat === "__none__" && effective) return false;
        if (filterCat !== "__none__" && effective !== filterCat) return false;
      }
      return true;
    });
  }, [titles, search, filterCat, pendingChanges]);

  const setTitleCategory = (norm: string, catId: string | null) => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      next.set(norm, catId);
      return next;
    });
  };

  const saveChanges = async () => {
    if (pendingChanges.size === 0) return;
    const upserts = Array.from(pendingChanges.entries()).map(([norm, catId]) => {
      const row = titles.find(t => t.title_normalized === norm);
      return {
        title_normalized: norm,
        title_display: row?.title_display || norm,
        category_id: catId,
      };
    });
    const { error } = await supabase.from("job_title_categories").upsert(upserts, { onConflict: "title_normalized" });
    if (error) return toast.error(error.message);
    toast.success(`حُفظت ${upserts.length} تصنيف`);
    load();
  };

  const addCategory = async () => {
    if (!newCatAr.trim()) return;
    const maxOrder = Math.max(0, ...categories.map(c => c.sort_order || 0));
    const { error } = await supabase.from("job_categories").insert({
      name_ar: newCatAr.trim(),
      name_en: newCatEn.trim() || null,
      sort_order: maxOrder + 1,
    });
    if (error) return toast.error(error.message);
    setNewCatAr(""); setNewCatEn("");
    toast.success("أُضيفت الفئة");
    load();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("حذف الفئة؟ سيتم إلغاء تصنيف الوظائف المرتبطة بها.")) return;
    const { error } = await supabase.from("job_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("حُذفت الفئة");
    load();
  };

  const updateCategory = async (id: string, patch: Partial<Category>) => {
    const { error } = await supabase.from("job_categories").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const aiCategorize = async () => {
    const unassigned = titles.filter(t => {
      const effective = pendingChanges.has(t.title_normalized) ? pendingChanges.get(t.title_normalized) : t.category_id;
      return !effective;
    });
    if (unassigned.length === 0) return toast.info("كل الوظائف مصنّفة بالفعل");
    if (categories.length === 0) return toast.error("أضف فئات أولاً");

    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-categorize-jobs", {
        body: {
          titles: unassigned.map(t => t.title_display),
          categories: categories.map(c => ({ id: c.id, name_ar: c.name_ar, name_en: c.name_en })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const assignments: { title: string; category_id: string }[] = data?.assignments || [];

      // Apply to pending changes
      setPendingChanges(prev => {
        const next = new Map(prev);
        for (const a of assignments) {
          const row = titles.find(t => t.title_display === a.title || normTitle(t.title_display) === normTitle(a.title));
          if (row) next.set(row.title_normalized, a.category_id);
        }
        return next;
      });
      toast.success(`اقترح AI تصنيف ${assignments.length} وظيفة — راجع واحفظ`);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setAiBusy(false);
    }
  };

  // Grouped view
  const grouped = useMemo(() => {
    const g = new Map<string, TitleRow[]>();
    filtered.forEach(t => {
      const effective = pendingChanges.has(t.title_normalized) ? pendingChanges.get(t.title_normalized) : t.category_id;
      const key = effective || "__none__";
      const arr = g.get(key) || [];
      arr.push(t);
      g.set(key, arr);
    });
    return g;
  }, [filtered, pendingChanges]);

  const catName = (id: string | null | undefined) => {
    if (!id) return "— بدون فئة —";
    return categories.find(c => c.id === id)?.name_ar || "—";
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FolderTree className="w-5 h-5" /> تنظيم وتصنيف المسميات الوظيفية</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="titles">
          <TabsList>
            <TabsTrigger value="titles">المسميات ({titles.length})</TabsTrigger>
            <TabsTrigger value="categories">الفئات ({categories.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="titles" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input placeholder="بحث في المسميات..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">كل الفئات</SelectItem>
                  <SelectItem value="__none__">— بدون فئة —</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setGroupByCategory(v => !v)} className="gap-1">
                <ArrowDownAZ className="w-4 h-4" />{groupByCategory ? "عرض قائمة" : "تجميع حسب الفئة"}
              </Button>
              <Button onClick={aiCategorize} disabled={aiBusy} className="gap-1 gradient-accent text-accent-foreground">
                {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                تصنيف تلقائي بالذكاء
              </Button>
              {pendingChanges.size > 0 && (
                <Button onClick={saveChanges} className="gap-1">
                  <Save className="w-4 h-4" />حفظ ({pendingChanges.size})
                </Button>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              مرتبة أبجدياً. مكررات محتملة تظهر متجاورة. تغييرات معلقة: {pendingChanges.size}
            </div>

            {groupByCategory ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {Array.from(grouped.entries()).sort((a, b) => catName(a[0] === "__none__" ? null : a[0]).localeCompare(catName(b[0] === "__none__" ? null : b[0]))).map(([catId, rows]) => {
                  const cat = catId === "__none__" ? null : categories.find(c => c.id === catId);
                  return (
                    <div key={catId} className="border rounded-md p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: cat?.color || "#94a3b8" }} />
                        <span className="font-semibold">{cat?.name_ar || "— بدون فئة —"}</span>
                        <Badge variant="secondary">{rows.length}</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {rows.map(row => (
                          <TitleRowItem key={row.title_normalized} row={row} categories={categories}
                            effective={pendingChanges.has(row.title_normalized) ? pendingChanges.get(row.title_normalized) ?? null : row.category_id}
                            onChange={(v) => setTitleCategory(row.title_normalized, v)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1 max-h-[600px] overflow-y-auto border rounded-md p-2">
                {filtered.map(row => (
                  <TitleRowItem key={row.title_normalized} row={row} categories={categories}
                    effective={pendingChanges.has(row.title_normalized) ? pendingChanges.get(row.title_normalized) ?? null : row.category_id}
                    onChange={(v) => setTitleCategory(row.title_normalized, v)} />
                ))}
                {filtered.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">لا نتائج</div>}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories" className="space-y-3">
            <div className="flex flex-wrap items-end gap-2 p-3 border rounded-md bg-muted/30">
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs font-medium">اسم بالعربي</label>
                <Input value={newCatAr} onChange={e => setNewCatAr(e.target.value)} placeholder="مثال: لوجستيات" />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs font-medium">اسم بالإنجليزي</label>
                <Input value={newCatEn} onChange={e => setNewCatEn(e.target.value)} placeholder="Logistics" />
              </div>
              <Button onClick={addCategory} className="gap-1"><Plus className="w-4 h-4" />إضافة</Button>
            </div>

            <div className="space-y-2">
              {categories.map(c => (
                <div key={c.id} className="flex items-center gap-2 p-3 border rounded-md">
                  <input
                    type="color"
                    value={c.color || "#6366f1"}
                    onChange={(e) => updateCategory(c.id, { color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border"
                  />
                  <Input defaultValue={c.name_ar} onBlur={e => e.target.value !== c.name_ar && updateCategory(c.id, { name_ar: e.target.value })} className="flex-1" />
                  <Input defaultValue={c.name_en || ""} onBlur={e => e.target.value !== c.name_en && updateCategory(c.id, { name_en: e.target.value || null })} className="flex-1" placeholder="English" />
                  <Badge variant="secondary">{titles.filter(t => t.category_id === c.id).length}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => deleteCategory(c.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function TitleRowItem({
  row, categories, effective, onChange,
}: { row: TitleRow; categories: Category[]; effective: string | null; onChange: (v: string | null) => void }) {
  const cat = effective ? categories.find(c => c.id === effective) : null;
  return (
    <div className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded text-sm">
      {cat && <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color || "#94a3b8" }} />}
      <span className="flex-1 truncate" title={row.title_display}>{row.title_display}</span>
      <Badge variant="outline" className="text-[10px] h-5">{row.count}</Badge>
      <Select value={effective || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
        <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— بدون —</SelectItem>
          {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
