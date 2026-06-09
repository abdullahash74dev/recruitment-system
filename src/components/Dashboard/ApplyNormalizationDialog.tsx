// Dialog: dry-run + PIN + signature confirmation before applying normalization to actual data
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, Loader2, Database, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fieldNames: string[]; // synonym field_names to apply
}

type ChangeRow = { column: string; from: string; to: string; count: number };

export default function ApplyNormalizationDialog({ open, onOpenChange, fieldNames }: Props) {
  const [step, setStep] = useState<"preview" | "confirm">("preview");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [report, setReport] = useState<Record<string, ChangeRow[]>>({});
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [grand, setGrand] = useState(0);
  const [affected, setAffected] = useState(0);
  const [pin, setPin] = useState("");
  const [signature, setSignature] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const runDryRun = async () => {
    setLoading(true);
    setReport({}); setTotals({}); setGrand(0); setAffected(0);
    try {
      const { data, error } = await supabase.functions.invoke("apply-value-normalization", {
        body: { field_names: fieldNames, dryRun: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setReport(data?.report || {});
      setTotals(data?.totals_by_field || {});
      setGrand(data?.grand_total || 0);
      setAffected(data?.affected_applicants || 0);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (confirmText.trim() !== "أؤكد" && confirmText.trim().toLowerCase() !== "confirm") {
      return toast.error("اكتب: أؤكد");
    }
    if (!pin || !signature.trim()) {
      return toast.error("الرقم السري والتوقيع مطلوبان");
    }
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("apply-value-normalization", {
        body: { field_names: fieldNames, dryRun: false, pin, signature: signature.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`تم تحديث ${data.applied} متقدم بنجاح${data.failures?.length ? ` (${data.failures.length} فشل)` : ""}`);
      onOpenChange(false);
      // reset
      setStep("preview"); setPin(""); setSignature(""); setConfirmText("");
      setReport({}); setTotals({}); setGrand(0); setAffected(0);
    } catch (e: any) {
      toast.error(String(e?.message || e));
    } finally {
      setApplying(false);
    }
  };

  // Run dry-run on open
  if (open && !loading && grand === 0 && Object.keys(report).length === 0 && fieldNames.length > 0) {
    setTimeout(() => { runDryRun(); }, 0);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setStep("preview"); setPin(""); setSignature(""); setConfirmText(""); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" />
            تطبيق التوحيد على البيانات الفعلية
          </DialogTitle>
          <DialogDescription>
            هذه عملية حساسة. ستُحدّث القيم في جدول المتقدمين بناءً على المرادفات المعرّفة. يتم حفظ نسخة احتياطية لكل سجل تلقائياً.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
        ) : grand === 0 ? (
          <Alert>
            <AlertDescription>لا توجد قيم تحتاج توحيداً في الحقول المختارة. كل البيانات موحَّدة.</AlertDescription>
          </Alert>
        ) : step === "preview" ? (
          <>
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertDescription className="space-y-1">
                <div className="font-semibold">سيتم تنفيذ التحويلات التالية:</div>
                <div className="flex gap-3 flex-wrap text-sm">
                  <Badge variant="secondary">إجمالي التحويلات: <b className="ms-1">{grand}</b></Badge>
                  <Badge variant="secondary">المتقدمون المتأثرون: <b className="ms-1">{affected}</b></Badge>
                  <Badge variant="secondary">الحقول: <b className="ms-1">{Object.keys(report).length}</b></Badge>
                </div>
              </AlertDescription>
            </Alert>

            <ScrollArea className="flex-1 max-h-[45vh] pr-2">
              <div className="space-y-3">
                {Object.entries(report).map(([field, rows]) => (
                  <div key={field} className="border rounded-md p-2.5">
                    <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Database className="w-4 h-4" /> {field}
                      <Badge variant="outline">{totals[field] || 0} تحويل</Badge>
                    </div>
                    <div className="space-y-1 text-xs">
                      {rows.slice(0, 30).map((r, i) => (
                        <div key={i} className="flex items-center gap-2 py-1 border-b last:border-0">
                          <span className="text-muted-foreground line-through truncate max-w-[200px]">{r.from}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-semibold text-accent truncate max-w-[200px]">{r.to}</span>
                          <Badge variant="secondary" className="ms-auto text-[10px]">×{r.count}</Badge>
                        </div>
                      ))}
                      {rows.length > 30 && <div className="text-muted-foreground text-center">... و {rows.length - 30} تحويل آخر</div>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
              <Button variant="destructive" onClick={() => setStep("confirm")} className="gap-1">
                <ShieldAlert className="w-4 h-4" />متابعة للتأكيد
              </Button>
            </div>
          </>
        ) : (
          <>
            <Alert className="border-destructive/50 bg-destructive/10">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                <div className="font-bold mb-1">تأكيد نهائي — لا يمكن التراجع بضغطة واحدة</div>
                <div className="text-sm">
                  ستُحدَّث <b>{affected} متقدم</b> بإجمالي <b>{grand} تحويل</b> في {Object.keys(report).length} حقل.
                  تُحفظ العملية في سجل النظام مع توقيعك. يمكن استرجاع السجلات الأصلية من سلة المحذوفات.
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div>
                <Label>الرقم السري (PIN)</Label>
                <Input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" autoFocus />
              </div>
              <div>
                <Label>التوقيع (اسمك أو معرّفك)</Label>
                <Input value={signature} onChange={e => setSignature(e.target.value)} placeholder="مثال: أحمد الخالدي - مدير النظام" />
              </div>
              <div>
                <Label>اكتب «أؤكد» للمتابعة</Label>
                <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="أؤكد" />
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-2 border-t">
              <Button variant="ghost" onClick={() => setStep("preview")}>← رجوع</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}><X className="w-4 h-4" />إلغاء</Button>
                <Button variant="destructive" onClick={apply} disabled={applying || !pin || !signature.trim() || (confirmText.trim() !== "أؤكد" && confirmText.trim().toLowerCase() !== "confirm")} className="gap-1">
                  {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  تنفيذ نهائي
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
