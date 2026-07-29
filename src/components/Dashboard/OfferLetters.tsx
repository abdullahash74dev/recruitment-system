import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileCheck,
  Plus,
  Send,
  CheckCircle,
  XCircle,
  Printer,
  Search,
  Pencil,
  TrendingUp,
  Clock,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  useOfferLettersQuery,
  useCreateOfferLetterMutation,
  useUpdateOfferLetterMutation,
  useSendOfferLetterMutation,
  type OfferLetterWithApplicant,
  type CreateOfferLetterInput,
  type ContractType,
  type OfferLetterStatus,
} from "@/hooks/queries/useOfferLetters";

// ---------------------------------------------------------------------------
// Constants & meta
// ---------------------------------------------------------------------------

const STATUS_META: Record<
  OfferLetterStatus,
  { label_ar: string; label_en: string; className: string }
> = {
  draft: {
    label_ar: "مسودة",
    label_en: "Draft",
    className:
      "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
  },
  sent: {
    label_ar: "مُرسَل",
    label_en: "Sent",
    className:
      "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  },
  accepted: {
    label_ar: "مقبول",
    label_en: "Accepted",
    className:
      "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
  },
  rejected: {
    label_ar: "مرفوض",
    label_en: "Rejected",
    className:
      "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  },
  expired: {
    label_ar: "منتهي",
    label_en: "Expired",
    className:
      "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700",
  },
};

const CONTRACT_TYPE_META: Record<
  ContractType,
  { label_ar: string; label_en: string }
> = {
  permanent: { label_ar: "دائم", label_en: "Permanent" },
  contract: { label_ar: "عقد مؤقت", label_en: "Contract" },
  part_time: { label_ar: "دوام جزئي", label_en: "Part-time" },
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({
  status,
  lang,
}: {
  status: OfferLetterStatus;
  lang: "ar" | "en";
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${meta.className}`}
    >
      {lang === "ar" ? meta.label_ar : meta.label_en}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stats cards
// ---------------------------------------------------------------------------

interface StatsData {
  total: number;
  pending: number;
  acceptanceRate: number;
  sent: number;
}

function StatsCards({ data, lang }: { data: StatsData; lang: "ar" | "en" }) {
  const isAr = lang === "ar";
  const cards = [
    {
      icon: <FileText className="w-5 h-5 text-primary" />,
      label: isAr ? "إجمالي العروض" : "Total Offers",
      value: data.total,
      sub: null,
    },
    {
      icon: <Clock className="w-5 h-5 text-blue-500" />,
      label: isAr ? "في الانتظار" : "Pending Response",
      value: data.pending,
      sub: isAr ? "عروض مُرسَلة بلا رد" : "Sent without response",
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-green-500" />,
      label: isAr ? "معدل القبول" : "Acceptance Rate",
      value: `${data.acceptanceRate}%`,
      sub:
        data.sent > 0
          ? isAr
            ? `من أصل ${data.sent} مُرسَل`
            : `out of ${data.sent} sent`
          : isAr
          ? "لا توجد عروض مُرسَلة بعد"
          : "No sent offers yet",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
      {cards.map((card, i) => (
        <Card key={i}>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                <p className="text-2xl font-bold leading-none text-foreground">
                  {card.value}
                </p>
                {card.sub && (
                  <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                )}
              </div>
              <div className="p-2 rounded-lg bg-muted shrink-0">{card.icon}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit dialog
// ---------------------------------------------------------------------------

interface FormState {
  applicant_id: string;
  position_title: string;
  department: string;
  salary_offered: string;
  salary_currency: string;
  start_date: string;
  contract_type: string;
  benefits: string;
  additional_terms: string;
  expires_at: string;
}

const EMPTY_FORM: FormState = {
  applicant_id: "",
  position_title: "",
  department: "",
  salary_offered: "",
  salary_currency: "SAR",
  start_date: "",
  contract_type: "permanent",
  benefits: "",
  additional_terms: "",
  expires_at: "",
};

function letterToForm(letter: OfferLetterWithApplicant): FormState {
  return {
    applicant_id: letter.applicant_id,
    position_title: letter.position_title,
    department: letter.department ?? "",
    salary_offered: letter.salary_offered != null ? String(letter.salary_offered) : "",
    salary_currency: letter.salary_currency,
    start_date: letter.start_date ?? "",
    contract_type: letter.contract_type,
    benefits: letter.benefits ?? "",
    additional_terms: letter.additional_terms ?? "",
    expires_at: letter.expires_at ? letter.expires_at.slice(0, 10) : "",
  };
}

function formToInput(form: FormState): CreateOfferLetterInput {
  return {
    applicant_id: form.applicant_id.trim(),
    position_title: form.position_title.trim(),
    department: form.department.trim() || null,
    salary_offered: form.salary_offered ? Number(form.salary_offered) : null,
    salary_currency: form.salary_currency || "SAR",
    start_date: form.start_date || null,
    contract_type: (form.contract_type as ContractType) || "permanent",
    benefits: form.benefits.trim() || null,
    additional_terms: form.additional_terms.trim() || null,
    expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
  };
}

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  editing: OfferLetterWithApplicant | null;
  lang: "ar" | "en";
}

function CreateDialog({ open, onClose, editing, lang }: CreateDialogProps) {
  const isAr = lang === "ar";
  const createMutation = useCreateOfferLetterMutation();
  const updateMutation = useUpdateOfferLetterMutation();

  const [form, setForm] = useState<FormState>(() =>
    editing ? letterToForm(editing) : EMPTY_FORM
  );

  // Sync form when editing target changes
  const [lastEditing, setLastEditing] = useState(editing);
  if (editing !== lastEditing) {
    setLastEditing(editing);
    setForm(editing ? letterToForm(editing) : EMPTY_FORM);
  }

  const set =
    (key: keyof FormState) =>
    (value: string) =>
      setForm((prev) => ({ ...prev, [key]: value }));

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async () => {
    if (!form.applicant_id.trim()) {
      toast.error(isAr ? "معرّف المتقدم مطلوب" : "Applicant ID is required");
      return;
    }
    if (!form.position_title.trim()) {
      toast.error(isAr ? "مسمى الوظيفة مطلوب" : "Position title is required");
      return;
    }

    const input = formToInput(form);
    if (editing) {
      const { applicant_id: _omit, ...patch } = input;
      updateMutation.mutate({ id: editing.id, patch }, { onSuccess: onClose });
    } else {
      createMutation.mutate(input, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-primary" />
            {editing
              ? isAr
                ? "تعديل عرض التوظيف"
                : "Edit Offer Letter"
              : isAr
              ? "إنشاء عرض توظيف جديد"
              : "New Offer Letter"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Applicant ID */}
          <div className="space-y-1">
            <Label htmlFor="ol-applicant">
              {isAr ? "معرّف المتقدم (UUID)" : "Applicant ID (UUID)"}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="ol-applicant"
              value={form.applicant_id}
              onChange={(e) => set("applicant_id")(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={!!editing}
              dir="ltr"
            />
          </div>

          {/* Position title */}
          <div className="space-y-1">
            <Label htmlFor="ol-position">
              {isAr ? "مسمى الوظيفة" : "Position Title"}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="ol-position"
              value={form.position_title}
              onChange={(e) => set("position_title")(e.target.value)}
              dir={isAr ? "rtl" : "ltr"}
            />
          </div>

          {/* Department */}
          <div className="space-y-1">
            <Label htmlFor="ol-dept">
              {isAr ? "القسم / الإدارة" : "Department"}
            </Label>
            <Input
              id="ol-dept"
              value={form.department}
              onChange={(e) => set("department")(e.target.value)}
              dir={isAr ? "rtl" : "ltr"}
            />
          </div>

          <Separator />

          {/* Salary row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="ol-salary">
                {isAr ? "الراتب المعروض" : "Salary Offered"}
              </Label>
              <Input
                id="ol-salary"
                type="number"
                min="0"
                step="0.01"
                value={form.salary_offered}
                onChange={(e) => set("salary_offered")(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ol-currency">
                {isAr ? "العملة" : "Currency"}
              </Label>
              <Select
                value={form.salary_currency}
                onValueChange={set("salary_currency")}
              >
                <SelectTrigger id="ol-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["SAR", "USD", "EUR", "GBP", "AED", "KWD", "QAR", "BHD", "OMR"].map(
                    (c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contract type & start date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ol-contract">
                {isAr ? "نوع العقد" : "Contract Type"}
              </Label>
              <Select
                value={form.contract_type}
                onValueChange={set("contract_type")}
              >
                <SelectTrigger id="ol-contract">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["permanent", "contract", "part_time"] as ContractType[]).map(
                    (ct) => (
                      <SelectItem key={ct} value={ct}>
                        {lang === "ar"
                          ? CONTRACT_TYPE_META[ct].label_ar
                          : CONTRACT_TYPE_META[ct].label_en}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ol-start">
                {isAr ? "تاريخ البداية" : "Start Date"}
              </Label>
              <Input
                id="ol-start"
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date")(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          {/* Expiry */}
          <div className="space-y-1">
            <Label htmlFor="ol-expires">
              {isAr ? "تاريخ انتهاء العرض" : "Offer Expiry Date"}
            </Label>
            <Input
              id="ol-expires"
              type="date"
              value={form.expires_at}
              onChange={(e) => set("expires_at")(e.target.value)}
              dir="ltr"
            />
          </div>

          <Separator />

          {/* Benefits */}
          <div className="space-y-1">
            <Label htmlFor="ol-benefits">
              {isAr ? "المزايا والمكافآت" : "Benefits & Perks"}
            </Label>
            <Textarea
              id="ol-benefits"
              value={form.benefits}
              onChange={(e) => set("benefits")(e.target.value)}
              rows={3}
              dir={isAr ? "rtl" : "ltr"}
              placeholder={
                isAr
                  ? "التأمين الصحي، الإجازات، بدلات السكن والمواصلات..."
                  : "Health insurance, annual leave, housing allowance..."
              }
            />
          </div>

          {/* Additional terms */}
          <div className="space-y-1">
            <Label htmlFor="ol-terms">
              {isAr ? "شروط إضافية" : "Additional Terms"}
            </Label>
            <Textarea
              id="ol-terms"
              value={form.additional_terms}
              onChange={(e) => set("additional_terms")(e.target.value)}
              rows={3}
              dir={isAr ? "rtl" : "ltr"}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending
              ? isAr
                ? "جارٍ الحفظ..."
                : "Saving..."
              : editing
              ? isAr
                ? "حفظ التعديلات"
                : "Save Changes"
              : isAr
              ? "إنشاء العرض"
              : "Create Offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Print view modal
// ---------------------------------------------------------------------------

function PrintViewDialog({
  letter,
  onClose,
  lang,
}: {
  letter: OfferLetterWithApplicant | null;
  onClose: () => void;
  lang: "ar" | "en";
}) {
  if (!letter) return null;
  const isAr = lang === "ar";
  const applicantName = letter.applicants?.full_name ?? "—";
  const contractMeta = CONTRACT_TYPE_META[letter.contract_type];

  const handlePrint = () => {
    const printContent = document.getElementById("offer-print-content");
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${isAr ? "rtl" : "ltr"}">
      <head>
        <meta charset="UTF-8" />
        <title>${isAr ? "عرض التوظيف" : "Offer Letter"}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #111; line-height: 1.6; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          h2 { font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; }
          p { margin: 4px 0; }
          .row { display: flex; gap: 40px; flex-wrap: wrap; }
          .field { min-width: 200px; }
          .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
          .value { font-size: 14px; font-weight: 600; }
          .footer { margin-top: 60px; }
          .sig-line { border-top: 1px solid #333; width: 200px; margin-top: 40px; }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const fmt = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Dialog open={!!letter} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            {isAr ? "معاينة عرض التوظيف" : "Offer Letter Preview"}
          </DialogTitle>
        </DialogHeader>

        {/* Printable content */}
        <div
          id="offer-print-content"
          className="border rounded-lg p-6 space-y-5 text-sm"
          dir={isAr ? "rtl" : "ltr"}
        >
          {/* Header */}
          <div className="text-center space-y-1 pb-4 border-b">
            <h1 className="text-xl font-bold">
              {isAr ? "خطاب عرض توظيف" : "OFFER LETTER"}
            </h1>
            <p className="text-muted-foreground text-xs">
              {isAr ? "تاريخ الإصدار:" : "Issue Date:"}{" "}
              {fmt(letter.created_at)}
            </p>
          </div>

          {/* Addressee */}
          <div>
            <p className="font-semibold text-base">{applicantName}</p>
            {letter.applicants?.email && (
              <p className="text-muted-foreground text-xs">
                {letter.applicants.email}
              </p>
            )}
          </div>

          <p className="leading-relaxed">
            {isAr
              ? `يسعدنا أن نتقدم إليكم بعرض للانضمام إلى فريقنا في منصب ${letter.position_title}${letter.department ? ` ضمن قسم ${letter.department}` : ""}.`
              : `We are pleased to extend this offer of employment for the position of ${letter.position_title}${letter.department ? ` within the ${letter.department} department` : ""}.`}
          </p>

          {/* Details grid */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm border-b pb-1">
              {isAr ? "تفاصيل العرض" : "Offer Details"}
            </h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {isAr ? "المسمى الوظيفي" : "Position"}
                </p>
                <p className="font-medium">{letter.position_title}</p>
              </div>
              {letter.department && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {isAr ? "القسم" : "Department"}
                  </p>
                  <p className="font-medium">{letter.department}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {isAr ? "نوع العقد" : "Contract Type"}
                </p>
                <p className="font-medium">
                  {isAr ? contractMeta.label_ar : contractMeta.label_en}
                </p>
              </div>
              {letter.start_date && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {isAr ? "تاريخ البداية" : "Start Date"}
                  </p>
                  <p className="font-medium">{fmt(letter.start_date)}</p>
                </div>
              )}
              {letter.salary_offered != null && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {isAr ? "الراتب الشهري" : "Monthly Salary"}
                  </p>
                  <p className="font-medium">
                    {new Intl.NumberFormat(isAr ? "ar-SA" : "en-US").format(
                      letter.salary_offered
                    )}{" "}
                    {letter.salary_currency}
                  </p>
                </div>
              )}
              {letter.expires_at && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {isAr ? "انتهاء العرض" : "Offer Expires"}
                  </p>
                  <p className="font-medium">{fmt(letter.expires_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Benefits */}
          {letter.benefits && (
            <div className="space-y-1">
              <h2 className="font-semibold text-sm border-b pb-1">
                {isAr ? "المزايا والمكافآت" : "Benefits & Perks"}
              </h2>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {letter.benefits}
              </p>
            </div>
          )}

          {/* Additional terms */}
          {letter.additional_terms && (
            <div className="space-y-1">
              <h2 className="font-semibold text-sm border-b pb-1">
                {isAr ? "شروط إضافية" : "Additional Terms"}
              </h2>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {letter.additional_terms}
              </p>
            </div>
          )}

          {/* Signature block */}
          <div className="pt-6 border-t mt-6">
            <p className="text-xs text-muted-foreground mb-8">
              {isAr
                ? "نرجو التوقيع أدناه للتأكيد على قبول هذا العرض أو الرد علينا في أقرب وقت ممكن."
                : "Please sign below to confirm your acceptance of this offer or respond at your earliest convenience."}
            </p>
            <div className="flex justify-between gap-12">
              <div className="space-y-1">
                <div className="border-t border-foreground w-48 pt-1">
                  <p className="text-xs text-muted-foreground">
                    {isAr ? "توقيع المرشح / التاريخ" : "Candidate Signature / Date"}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="border-t border-foreground w-48 pt-1">
                  <p className="text-xs text-muted-foreground">
                    {isAr ? "توقيع الشركة / التاريخ" : "Company Signature / Date"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {isAr ? "إغلاق" : "Close"}
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            {isAr ? "طباعة" : "Print"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OfferLetters() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";

  const { data: letters = [], isLoading } = useOfferLettersQuery();
  const updateMutation = useUpdateOfferLetterMutation();
  const sendMutation = useSendOfferLetterMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OfferLetterWithApplicant | null>(null);
  const [printLetter, setPrintLetter] = useState<OfferLetterWithApplicant | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OfferLetterStatus | "all">("all");

  // Stats
  const stats = useMemo<StatsData>(() => {
    const total = letters.length;
    const pending = letters.filter((l) => l.status === "sent").length;
    const responded = letters.filter(
      (l) => l.status === "accepted" || l.status === "rejected"
    );
    const accepted = letters.filter((l) => l.status === "accepted").length;
    const sentTotal = letters.filter(
      (l) => l.status !== "draft"
    ).length;
    const acceptanceRate =
      responded.length > 0 ? Math.round((accepted / responded.length) * 100) : 0;
    return { total, pending, acceptanceRate, sent: sentTotal };
  }, [letters]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return letters.filter((l) => {
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchSearch =
        !q ||
        l.position_title.toLowerCase().includes(q) ||
        (l.department ?? "").toLowerCase().includes(q) ||
        (l.applicants?.full_name ?? "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [letters, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (letter: OfferLetterWithApplicant) => {
    setEditing(letter);
    setDialogOpen(true);
  };

  const handleSend = (letter: OfferLetterWithApplicant) => {
    if (
      !confirm(
        isAr
          ? "هل تريد إرسال هذا العرض؟ سيتغير الوضع إلى 'مُرسَل'."
          : "Send this offer? Status will change to 'Sent'."
      )
    )
      return;
    sendMutation.mutate(letter.id);
  };

  const handleAccept = (letter: OfferLetterWithApplicant) => {
    if (
      !confirm(
        isAr ? "هل تريد تسجيل قبول هذا العرض؟" : "Mark this offer as accepted?"
      )
    )
      return;
    updateMutation.mutate({
      id: letter.id,
      patch: { status: "accepted", responded_at: new Date().toISOString() } as any,
    });
  };

  const handleReject = (letter: OfferLetterWithApplicant) => {
    if (
      !confirm(
        isAr ? "هل تريد تسجيل رفض هذا العرض؟" : "Mark this offer as rejected?"
      )
    )
      return;
    updateMutation.mutate({
      id: letter.id,
      patch: { status: "rejected", responded_at: new Date().toISOString() } as any,
    });
  };

  const fmt = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <StatsCards data={stats} lang={lang} />

      {/* Main card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck className="w-5 h-5 text-primary" />
            {isAr ? "عروض التوظيف" : "Offer Letters"}
            <Badge variant="secondary" className="ml-1">
              {letters.length}
            </Badge>
          </CardTitle>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status filter */}
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as OfferLetterStatus | "all")}
            >
              <SelectTrigger className="h-8 text-sm w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {isAr ? "جميع الحالات" : "All Statuses"}
                </SelectItem>
                {(
                  ["draft", "sent", "accepted", "rejected", "expired"] as OfferLetterStatus[]
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {isAr ? STATUS_META[s].label_ar : STATUS_META[s].label_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 h-8 text-sm w-48"
                placeholder={isAr ? "بحث..." : "Search..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                dir={isAr ? "rtl" : "ltr"}
              />
            </div>

            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="w-4 h-4" />
              {isAr ? "عرض جديد" : "New Offer"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <ScrollArea className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isAr ? "المتقدم" : "Applicant"}</TableHead>
                  <TableHead>{isAr ? "الوظيفة" : "Position"}</TableHead>
                  <TableHead>{isAr ? "الراتب" : "Salary"}</TableHead>
                  <TableHead>{isAr ? "نوع العقد" : "Contract"}</TableHead>
                  <TableHead>{isAr ? "البداية" : "Start Date"}</TableHead>
                  <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isAr ? "تاريخ الإنشاء" : "Created"}</TableHead>
                  <TableHead className="w-36"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground text-sm"
                    >
                      {isAr ? "جارٍ التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground text-sm"
                    >
                      {isAr ? "لا توجد عروض توظيف بعد" : "No offer letters yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((letter) => (
                    <TableRow key={letter.id}>
                      {/* Applicant */}
                      <TableCell className="font-medium text-sm max-w-[160px] truncate">
                        {letter.applicants?.full_name ?? (
                          <span className="text-muted-foreground font-mono text-xs">
                            {letter.applicant_id.slice(0, 8)}…
                          </span>
                        )}
                      </TableCell>

                      {/* Position */}
                      <TableCell className="text-sm max-w-[180px]">
                        <div className="truncate font-medium">
                          {letter.position_title}
                        </div>
                        {letter.department && (
                          <div className="text-xs text-muted-foreground truncate">
                            {letter.department}
                          </div>
                        )}
                      </TableCell>

                      {/* Salary */}
                      <TableCell className="text-sm whitespace-nowrap">
                        {letter.salary_offered != null ? (
                          <>
                            {new Intl.NumberFormat(
                              isAr ? "ar-SA" : "en-US"
                            ).format(letter.salary_offered)}{" "}
                            <span className="text-xs text-muted-foreground">
                              {letter.salary_currency}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Contract type */}
                      <TableCell className="text-sm">
                        {isAr
                          ? CONTRACT_TYPE_META[letter.contract_type].label_ar
                          : CONTRACT_TYPE_META[letter.contract_type].label_en}
                      </TableCell>

                      {/* Start date */}
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {fmt(letter.start_date)}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={letter.status} lang={lang} />
                      </TableCell>

                      {/* Created at */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmt(letter.created_at)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {/* Edit (draft only) */}
                          {letter.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={isAr ? "تعديل" : "Edit"}
                              onClick={() => openEdit(letter)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {/* Send (draft only) */}
                          {letter.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:text-blue-600"
                              title={isAr ? "إرسال" : "Send"}
                              onClick={() => handleSend(letter)}
                              disabled={sendMutation.isPending}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {/* Accept (sent only) */}
                          {letter.status === "sent" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600 hover:text-green-600"
                              title={isAr ? "قبول" : "Accept"}
                              onClick={() => handleAccept(letter)}
                              disabled={updateMutation.isPending}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {/* Reject (sent only) */}
                          {letter.status === "sent" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              title={isAr ? "رفض" : "Reject"}
                              onClick={() => handleReject(letter)}
                              disabled={updateMutation.isPending}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {/* Print preview (always visible) */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title={isAr ? "معاينة وطباعة" : "Preview & Print"}
                            onClick={() => setPrintLetter(letter)}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <CreateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
        lang={lang}
      />

      {/* Print view dialog */}
      <PrintViewDialog
        letter={printLetter}
        onClose={() => setPrintLetter(null)}
        lang={lang}
      />
    </div>
  );
}
