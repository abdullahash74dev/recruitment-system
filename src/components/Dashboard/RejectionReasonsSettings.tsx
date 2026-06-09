import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Reason {
  id: string;
  reason_ar: string;
  reason_en: string | null;
  is_active: boolean;
  sort_order: number;
}

export default function RejectionReasonsSettings() {
  const [items, setItems] = useState<Reason[]>([]);
  const [newAr, setNewAr] = useState("");
  const [newEn, setNewEn] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("rejection_reasons")
      .select("*")
      .order("sort_order");
    setItems(data || []);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newAr.trim()) return toast.error("أدخل السبب بالعربية");
    setLoading(true);
    const { error } = await (supabase as any).from("rejection_reasons").insert({
      reason_ar: newAr.trim(),
      reason_en: newEn.trim() || null,
      sort_order: items.length + 1,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setNewAr(""); setNewEn("");
    toast.success("تمت الإضافة");
    load();
  };

  const update = async (id: string, patch: Partial<Reason>) => {
    const { error } = await (supabase as any).from("rejection_reasons").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا السبب؟")) return;
    const { error } = await (supabase as any).from("rejection_reasons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>أسباب الرفض</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
          <div className="space-y-1">
            <Label>السبب (عربي)</Label>
            <Input value={newAr} onChange={(e) => setNewAr(e.target.value)} dir="rtl" />
          </div>
          <div className="space-y-1">
            <Label>السبب (إنجليزي)</Label>
            <Input value={newEn} onChange={(e) => setNewEn(e.target.value)} />
          </div>
          <Button onClick={add} disabled={loading}>
            <Plus className="w-4 h-4 me-1" /> إضافة
          </Button>
        </div>

        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 border border-border rounded-lg p-2">
              <Input
                value={r.reason_ar}
                onChange={(e) => setItems((prev) => prev.map((x) => x.id === r.id ? { ...x, reason_ar: e.target.value } : x))}
                onBlur={(e) => update(r.id, { reason_ar: e.target.value })}
                dir="rtl"
                className="flex-1 min-w-[200px]"
              />
              <Input
                value={r.reason_en || ""}
                onChange={(e) => setItems((prev) => prev.map((x) => x.id === r.id ? { ...x, reason_en: e.target.value } : x))}
                onBlur={(e) => update(r.id, { reason_en: e.target.value || null })}
                placeholder="English"
                className="flex-1 min-w-[200px]"
              />
              <div className="flex items-center gap-2">
                <Switch checked={r.is_active} onCheckedChange={(v) => update(r.id, { is_active: v })} />
                <span className="text-xs text-muted-foreground">{r.is_active ? "مُفعّل" : "معطّل"}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد أسباب بعد</p>}
        </div>
      </CardContent>
    </Card>
  );
}
