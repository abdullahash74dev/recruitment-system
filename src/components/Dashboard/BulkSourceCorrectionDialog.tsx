import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { logAudit } from "@/lib/audit";

// Keeps a single .in() filter from growing unbounded when the selection is large.
const CHUNK = 300;
const chunk = (ids: string[]): string[][] => {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) out.push(ids.slice(i, i + CHUNK));
  return out;
};

interface Props {
  applicants: { id: string; full_name: string; source?: string | null; source_company?: string | null }[];
  onClose: () => void;
  onUpdated: () => void;
}

export default function BulkSourceCorrectionDialog({ applicants, onClose, onUpdated }: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [source, setSource] = useState<"direct" | "external">("external");
  const [sourceCompany, setSourceCompany] = useState("");
  const [busy, setBusy] = useState(false);

  const handleApply = async () => {
    if (source === "external" && !sourceCompany.trim()) {
      toast.error(ar ? "اكتب اسم الشركة المصدر" : "Enter the source company name");
      return;
    }
    setBusy(true);
    try {
      const ids = applicants.map(a => a.id);
      const payload = {
        source,
        source_company: source === "external" ? sourceCompany.trim() : null,
      };
      for (const batch of chunk(ids)) {
        const { error } = await supabase.from("applicants").update(payload).in("id", batch);
        if (error) { toast.error(error.message); return; }
      }
      await logAudit({
        action: "CUSTOM",
        summary: `Bulk source correction: ${ids.length} applicant(s) set to "${source}"${payload.source_company ? ` (${payload.source_company})` : ""}`,
        table_name: "applicants",
        metadata: { ids, ...payload },
      });
      toast.success(ar ? `تم تصحيح مصدر ${ids.length} متقدم` : `Corrected source for ${ids.length} applicants`);
      onUpdated();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {ar ? `تصحيح مصدر ${applicants.length} متقدم` : `Correct source for ${applicants.length} applicants`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {ar
              ? "استخدم هذه الأداة لتصحيح متقدمين تم استيرادهم سابقاً وانحفظوا بالخطأ كـ\"تقديم مباشر\" بينما هم في الأصل بيانات حصلت عليها من جهة خارجية (بنك بيانات)."
              : "Use this to fix applicants that were previously imported and incorrectly saved as \"direct\" when they actually came from an external data source."}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" checked={source === "direct"} onChange={() => setSource("direct")} />
              <span>{ar ? "تقديم مباشر على شركتنا" : "Direct application"}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" checked={source === "external"} onChange={() => setSource("external")} />
              <span>{ar ? "مستورد من شركة خارجية (بنك بيانات)" : "Imported from external company (data bank)"}</span>
            </label>
          </div>
          {source === "external" && (
            <input
              type="text"
              value={sourceCompany}
              onChange={(e) => setSourceCompany(e.target.value)}
              placeholder={ar ? "اسم الشركة المصدر (مثلاً: فهد الكستبان)" : "Source company name"}
              className="w-full h-9 px-2 rounded border bg-background text-sm"
            />
          )}
          <div className="text-[11px] text-muted-foreground">
            {ar
              ? "سيتم استبدال قيمة المصدر الحالية لكل المتقدمين المحددين أدناه."
              : "This will overwrite the current source value for every applicant selected below."}
          </div>
          <div className="max-h-32 overflow-auto text-xs border rounded p-2 bg-muted/30">
            {applicants.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-2">
                <span>• {a.full_name}</span>
                <span className="text-muted-foreground">
                  {a.source === "external" ? `📦 ${a.source_company || (ar ? "خارجي" : "external")}` : (ar ? "مباشر" : "direct")}
                </span>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={handleApply} disabled={busy}>
            {busy ? (ar ? "جاري التحديث..." : "Updating...") : (ar ? "تطبيق" : "Apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
