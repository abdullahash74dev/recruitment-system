import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Copy, Loader2, Archive, Trash2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDeletePin } from "@/components/DeletePinDialog";
import { groupDuplicates, richness } from "@/lib/applicantDuplicates";

interface Applicant {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  desired_position: string | null;
  created_at: string;
  is_archived?: boolean | null;
  [key: string]: unknown;
}

interface Props {
  applicants: any[];
  onChanged: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// How many ids to send per request — keeps a single .in() filter from growing unbounded.
const CHUNK = 300;

// Prefer an active (non-archived) record, then the most complete one, then the most recent.
const pickKeeper = (group: Applicant[]): string => {
  let best = group[0];
  for (const r of group.slice(1)) {
    const bArchived = !!best.is_archived, rArchived = !!r.is_archived;
    if (rArchived !== bArchived) { if (!rArchived) best = r; continue; }
    const rr = richness(r), br = richness(best);
    if (rr !== br) { if (rr > br) best = r; continue; }
    if (new Date(r.created_at).getTime() > new Date(best.created_at).getTime()) best = r;
  }
  return best.id;
};

const chunk = (ids: string[]): string[][] => {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) out.push(ids.slice(i, i + CHUNK));
  return out;
};

export default function ApplicantsDuplicateCleanup({ applicants, onChanged, open, onOpenChange }: Props) {
  const { requestDelete } = useDeletePin();
  const [scanned, setScanned] = useState(false);
  const [groups, setGroups] = useState<Applicant[][]>([]);
  const [keepIds, setKeepIds] = useState<Record<string, string>>({});
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(25);
  const [busy, setBusy] = useState(false);

  const runScan = () => {
    setScanned(false);
    const found = groupDuplicates(applicants).sort((a, b) => b.length - a.length);
    const initKeep: Record<string, string> = {};
    found.forEach(g => { initKeep[g[0].id] = pickKeeper(g); });
    setGroups(found);
    setKeepIds(initKeep);
    setIgnored(new Set());
    setVisibleCount(25);
    setScanned(true);
  };

  // Re-scan every time the dialog opens — whether opened manually or right after an import finishes.
  useEffect(() => {
    if (open) runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g => g.some(r =>
      (r.full_name || "").toLowerCase().includes(q) ||
      (r.phone || "").includes(q) ||
      (String(r.email || "")).toLowerCase().includes(q)
    ));
  }, [groups, search]);

  const activeGroups = useMemo(() => filteredGroups.filter(g => !ignored.has(g[0].id)), [filteredGroups, ignored]);

  const removalIds = useMemo(() => {
    const ids: string[] = [];
    activeGroups.forEach(g => {
      const keep = keepIds[g[0].id];
      g.forEach(r => { if (r.id !== keep) ids.push(r.id); });
    });
    return ids;
  }, [activeGroups, keepIds]);

  const totalRedundant = groups.reduce((sum, g) => sum + g.length - 1, 0);
  const visibleGroups = activeGroups.slice(0, visibleCount);

  const runBulk = async (action: (batch: string[]) => Promise<{ error: { message: string } | null }>, successMsg: (n: number) => string) => {
    setBusy(true);
    try {
      for (const batch of chunk(removalIds)) {
        const { error } = await action(batch);
        if (error) { toast.error(error.message); return; }
      }
      toast.success(successMsg(removalIds.length));
      onChanged();
      runScan();
    } finally {
      setBusy(false);
    }
  };

  const archiveSelected = () => {
    if (removalIds.length === 0) return;
    runBulk(
      batch => supabase.from("applicants").update({ is_archived: true, archived_at: new Date().toISOString() }).in("id", batch),
      n => `تمت أرشفة ${n} سجل مكرر`
    );
  };

  const deleteSelected = () => {
    if (removalIds.length === 0) return;
    requestDelete({
      message: `سيتم حذف ${removalIds.length} سجل مكرر نهائياً من قائمة المتقدمين (تبقى قابلة للاستعادة من سلة المحذوفات خلال 30 يوماً).`,
      onConfirm: () => runBulk(
        batch => supabase.from("applicants").delete().in("id", batch),
        n => `تم حذف ${n} سجل مكرر`
      ),
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-muted/30">
        <Copy className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">كشف وتنظيف المكررات:</span>
        <Button size="sm" variant="outline" onClick={() => onOpenChange(true)} className="gap-1">
          <Search className="w-3.5 h-3.5" />
          فحص المتقدمين الحاليين ({applicants.length})
        </Button>
        <span className="text-xs text-muted-foreground">يبحث عن تكرار سابق بين كل المتقدمين المسجلين فعلياً، ويتيح أرشفة أو حذف النسخ الزائدة بأمان. يفتح تلقائياً أيضاً بعد كل استيراد ناجح.</span>
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Copy className="w-5 h-5 text-primary" />مراجعة المكررات</DialogTitle>
            <DialogDescription>
              يستخدم نفس منطق المطابقة المعتمد في الاستيراد (الاسم + الجوال/الإيميل + الوظيفة). السجل المقترح للاحتفاظ به محدد تلقائياً (غير مؤرشف والأكثر اكتمالاً)، ويمكنك تغييره يدوياً قبل التنفيذ.
            </DialogDescription>
          </DialogHeader>

          {!scanned ? (
            <div className="flex-1 flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : groups.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground py-10">لا يوجد أي تكرار بين المتقدمين الحاليين 🎉</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 text-sm">
                <span>تم العثور على <b>{groups.length}</b> مجموعة مكررة، بإجمالي <b>{totalRedundant}</b> سجل زائد مقترح للإزالة.</span>
                <Button size="sm" variant="outline" onClick={runScan} className="gap-1 ms-auto"><RefreshCw className="w-3.5 h-3.5" />إعادة الفحص</Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Input value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(25); }} placeholder="ابحث بالاسم / الجوال / الإيميل داخل المجموعات" className="max-w-sm" />
                <span className="text-xs text-muted-foreground">{activeGroups.length} مجموعة قيد المراجعة{ignored.size > 0 ? ` · تم تجاوز ${ignored.size}` : ""}</span>
                <div className="flex gap-2 ms-auto">
                  <Button size="sm" variant="default" disabled={busy || removalIds.length === 0} onClick={archiveSelected} className="gap-1">
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />} أرشفة المقترح للإزالة ({removalIds.length})
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy || removalIds.length === 0} onClick={deleteSelected} className="gap-1 text-destructive border-destructive/40 hover:bg-destructive/10">
                    <Trash2 className="w-3.5 h-3.5" /> حذف نهائي ({removalIds.length})
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <div className="divide-y">
                  {visibleGroups.map(g => {
                    const gKey = g[0].id;
                    const keep = keepIds[gKey];
                    return (
                      <div key={gKey} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{g[0].full_name} <Badge variant="secondary" className="ms-1">{g.length} نسخ</Badge></span>
                          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setIgnored(prev => new Set(prev).add(gKey))}>ليست مكررة — تجاوز</Button>
                        </div>
                        <RadioGroup value={keep} onValueChange={(v) => setKeepIds(prev => ({ ...prev, [gKey]: v }))}>
                          <div className="space-y-1">
                            {g.map(r => (
                              <label key={r.id} className="flex flex-wrap items-center gap-2 text-xs rounded-md border p-2 cursor-pointer hover:bg-muted/40">
                                <RadioGroupItem value={r.id} />
                                <span className={`font-medium ${r.id === keep ? "text-emerald-600" : "text-destructive"}`}>{r.id === keep ? "احتفاظ" : "إزالة"}</span>
                                <span>{r.phone || "—"}</span>
                                <span>{r.email || "—"}</span>
                                <span>{r.desired_position || "—"}</span>
                                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar")}</span>
                                {r.is_archived ? <Badge variant="outline">مؤرشف</Badge> : null}
                                <span className="text-muted-foreground ms-auto">اكتمال: {richness(r)}</span>
                              </label>
                            ))}
                          </div>
                        </RadioGroup>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              {activeGroups.length > visibleGroups.length && (
                <Button size="sm" variant="outline" onClick={() => setVisibleCount(v => v + 25)}>
                  تحميل المزيد ({activeGroups.length - visibleGroups.length} متبقي)
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
