import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import {
  renderApplicantEmail,
  type ApplicantEmailStatus,
  type TemplateContext,
} from "@/lib/applicantEmailTemplates";
import { useRejectionReasonsQuery } from "@/hooks/queries/useRejectionReasons";
import { useSiteContent } from "@/hooks/useSiteContent";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  applicantId: string;
  applicantName: string;
  applicantEmail: string | null;
  applicantLanguage?: "ar" | "en";
  positionAr?: string | null;
  positionEn?: string | null;
  status: ApplicantEmailStatus;
  /** بعد التأكيد ينفّذ هذا (مثلاً تحديث حالة المرشح) */
  onConfirmed?: () => Promise<void> | void;
}

export default function ApplicantEmailDialog({
  open,
  onOpenChange,
  applicantId,
  applicantName,
  applicantEmail,
  applicantLanguage = "ar",
  positionAr,
  positionEn,
  status,
  onConfirmed,
}: Props) {
  const [language, setLanguage] = useState<"ar" | "en">(applicantLanguage);
  const [reasonId, setReasonId] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { content } = useSiteContent();
  const companyAr = content.site_name_ar;
  const companyEn = content.site_name_en;
  const { data: allReasons = [] } = useRejectionReasonsQuery();
  const reasons = useMemo(() => allReasons.filter((r) => r.is_active), [allReasons]);

  useEffect(() => {
    if (!open) return;
    setLanguage(applicantLanguage);
    setReasonId("");
    setNote("");
  }, [open, applicantLanguage]);

  const selectedReason = useMemo(
    () => reasons.find((r) => r.id === reasonId),
    [reasons, reasonId]
  );

  // إعادة توليد المعاينة عند تغيير اللغة/السبب/الملاحظة
  useEffect(() => {
    if (!open) return;
    const ctx: TemplateContext = {
      fullName: applicantName,
      positionAr,
      positionEn,
      companyAr,
      companyEn,
      rejectionReasonAr: selectedReason?.reason_ar,
      rejectionReasonEn: selectedReason?.reason_en,
      rejectionNote: note || null,
    };
    const rendered = renderApplicantEmail(status, language, ctx);
    setSubject(rendered.subject);
    setBody(rendered.body);
  }, [open, language, selectedReason, note, status, applicantName, positionAr, positionEn, companyAr, companyEn]);

  const handleConfirm = async () => {
    if (!applicantEmail) {
      toast.error("لا يوجد بريد إلكتروني للمرشح");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-applicant-email", {
        body: {
          applicantId,
          templateKey: status,
          statusAtSend: status,
          recipientEmail: applicantEmail,
          language,
          subject,
          emailBody: body,
          rejectionReasonId: status === "rejected" ? reasonId || null : null,
          rejectionNote: status === "rejected" ? note || null : null,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "فشل إرسال الإيميل");

      await logAudit({
        action: "CUSTOM",
        summary: `تم إرسال إيميل (${status}) للمرشح ${applicantName}`,
        table_name: "applicant_emails",
        record_id: applicantId,
        metadata: { status, language, has_reason: !!reasonId },
      });

      toast.success("تم إرسال الإيميل بنجاح");
      if (onConfirmed) await onConfirmed();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "فشل إرسال الإيميل");
    } finally {
      setSending(false);
    }
  };

  const isRejected = status === "rejected";
  const dir = language === "ar" ? "rtl" : "ltr";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            تأكيد إرسال إيميل للمرشح
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <Badge variant="outline">{applicantName}</Badge>
            <Badge variant="secondary">{applicantEmail || "بدون بريد"}</Badge>
            <Badge>{status}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>لغة الإيميل</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as "ar" | "en")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isRejected && (
              <div className="space-y-1">
                <Label>سبب الرفض</Label>
                <Select value={reasonId} onValueChange={setReasonId}>
                  <SelectTrigger><SelectValue placeholder="اختر سبباً (اختياري)" /></SelectTrigger>
                  <SelectContent>
                    {reasons.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {language === "en" && r.reason_en ? r.reason_en : r.reason_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isRejected && (
            <div className="space-y-1">
              <Label>ملاحظة إضافية (اختياري)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="نص قصير يظهر في الإيميل" />
            </div>
          )}

          <div className="space-y-1">
            <Label>الموضوع</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} dir={dir} />
          </div>

          <div className="space-y-1">
            <Label>نص الإيميل (يمكنك تعديله قبل الإرسال)</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              dir={dir}
              className="min-h-[260px] font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            إلغاء
          </Button>
          <Button onClick={handleConfirm} disabled={sending || !applicantEmail}>
            {sending ? "جارٍ الإرسال..." : "إرسال الإيميل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
