import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
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
  Star,
  Plus,
  Trash2,
  Pencil,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  useScorecardsQuery,
  useCreateScorecardMutation,
  useUpdateScorecardMutation,
  useDeleteScorecardMutation,
  type ScorecardRecommendation,
  type ScorecardWithApplicant,
  type CreateScorecardInput,
} from "@/hooks/queries/useScorecards";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

const RECOMMENDATION_META: Record<
  ScorecardRecommendation,
  { label_ar: string; label_en: string; className: string }
> = {
  strong_hire: {
    label_ar: "توظيف أكيد",
    label_en: "Strong Hire",
    className:
      "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300",
  },
  hire: {
    label_ar: "يُنصح بالتوظيف",
    label_en: "Hire",
    className:
      "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/40 dark:text-teal-300",
  },
  maybe: {
    label_ar: "ربما",
    label_en: "Maybe",
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300",
  },
  no_hire: {
    label_ar: "لا يُنصح",
    label_en: "No Hire",
    className:
      "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300",
  },
  strong_no: {
    label_ar: "رفض قاطع",
    label_en: "Strong No",
    className:
      "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300",
  },
};

const RECOMMENDATIONS = Object.keys(RECOMMENDATION_META) as ScorecardRecommendation[];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RecommendationBadge({
  value,
  lang,
}: {
  value: ScorecardRecommendation | null | undefined;
  lang: "ar" | "en";
}) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  const meta = RECOMMENDATION_META[value];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${meta.className}`}
    >
      {lang === "ar" ? meta.label_ar : meta.label_en}
    </span>
  );
}

function StarRating({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {RATING_OPTIONS.map((n) => (
        <Star
          key={n}
          className={`w-3 h-3 ${
            n <= value
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted-foreground/30"
          }`}
        />
      ))}
    </span>
  );
}

function RatingSelect({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {RATING_OPTIONS.map((n) => (
          <SelectItem key={n} value={String(n)}>
            {n} {Array(n).fill("★").join("")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Form state helpers
// ---------------------------------------------------------------------------

interface FormState {
  applicant_id: string;
  evaluator_email: string;
  overall_rating: string;
  communication_rating: string;
  technical_rating: string;
  culture_fit_rating: string;
  strengths: string;
  weaknesses: string;
  recommendation: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  applicant_id: "",
  evaluator_email: "",
  overall_rating: "",
  communication_rating: "",
  technical_rating: "",
  culture_fit_rating: "",
  strengths: "",
  weaknesses: "",
  recommendation: "",
  notes: "",
};

function formToInput(form: FormState): CreateScorecardInput {
  return {
    applicant_id: form.applicant_id,
    evaluator_email: form.evaluator_email.trim() || null,
    overall_rating: form.overall_rating ? Number(form.overall_rating) : null,
    communication_rating: form.communication_rating
      ? Number(form.communication_rating)
      : null,
    technical_rating: form.technical_rating
      ? Number(form.technical_rating)
      : null,
    culture_fit_rating: form.culture_fit_rating
      ? Number(form.culture_fit_rating)
      : null,
    strengths: form.strengths.trim() || null,
    weaknesses: form.weaknesses.trim() || null,
    recommendation: (form.recommendation as ScorecardRecommendation) || null,
    notes: form.notes.trim() || null,
  };
}

function scorecardToForm(sc: ScorecardWithApplicant): FormState {
  return {
    applicant_id: sc.applicant_id,
    evaluator_email: sc.evaluator_email ?? "",
    overall_rating: sc.overall_rating != null ? String(sc.overall_rating) : "",
    communication_rating:
      sc.communication_rating != null ? String(sc.communication_rating) : "",
    technical_rating:
      sc.technical_rating != null ? String(sc.technical_rating) : "",
    culture_fit_rating:
      sc.culture_fit_rating != null ? String(sc.culture_fit_rating) : "",
    strengths: sc.strengths ?? "",
    weaknesses: sc.weaknesses ?? "",
    recommendation: sc.recommendation ?? "",
    notes: sc.notes ?? "",
  };
}

// ---------------------------------------------------------------------------
// Applicant summary row
// ---------------------------------------------------------------------------

interface ApplicantSummary {
  applicant_id: string;
  applicant_name: string;
  count: number;
  avgOverall: number | null;
  avgCommunication: number | null;
  avgTechnical: number | null;
  avgCultureFit: number | null;
  scorecards: ScorecardWithApplicant[];
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function useApplicantSummaries(
  scorecards: ScorecardWithApplicant[]
): ApplicantSummary[] {
  return useMemo(() => {
    const map = new Map<string, ScorecardWithApplicant[]>();
    for (const sc of scorecards) {
      const list = map.get(sc.applicant_id) ?? [];
      list.push(sc);
      map.set(sc.applicant_id, list);
    }
    return Array.from(map.entries()).map(([applicant_id, scs]) => ({
      applicant_id,
      applicant_name: scs[0]?.applicants?.full_name ?? applicant_id,
      count: scs.length,
      avgOverall: avg(scs.map((s) => s.overall_rating)),
      avgCommunication: avg(scs.map((s) => s.communication_rating)),
      avgTechnical: avg(scs.map((s) => s.technical_rating)),
      avgCultureFit: avg(scs.map((s) => s.culture_fit_rating)),
      scorecards: scs,
    }));
  }, [scorecards]);
}

// ---------------------------------------------------------------------------
// Scorecard dialog
// ---------------------------------------------------------------------------

interface ScorecardDialogProps {
  open: boolean;
  onClose: () => void;
  editing: ScorecardWithApplicant | null;
  lang: "ar" | "en";
}

function ScorecardDialog({
  open,
  onClose,
  editing,
  lang,
}: ScorecardDialogProps) {
  const isAr = lang === "ar";
  const createMutation = useCreateScorecardMutation();
  const updateMutation = useUpdateScorecardMutation();

  const [form, setForm] = useState<FormState>(() =>
    editing ? scorecardToForm(editing) : EMPTY_FORM
  );

  // Reset whenever dialog opens/switches between create and edit
  const [lastEditing, setLastEditing] = useState(editing);
  if (editing !== lastEditing) {
    setLastEditing(editing);
    setForm(editing ? scorecardToForm(editing) : EMPTY_FORM);
  }

  const set = (key: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async () => {
    if (!form.applicant_id.trim()) {
      toast.error(isAr ? "معرّف المتقدم مطلوب" : "Applicant ID is required");
      return;
    }
    const input = formToInput(form);
    if (editing) {
      const { applicant_id: _ignored, ...patch } = input;
      updateMutation.mutate(
        { id: editing.id, patch },
        { onSuccess: onClose }
      );
    } else {
      createMutation.mutate(input, { onSuccess: onClose });
    }
  };

  const title = editing
    ? isAr
      ? "تعديل التقييم"
      : "Edit Scorecard"
    : isAr
    ? "إضافة تقييم جديد"
    : "New Scorecard";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Applicant ID */}
          <div className="space-y-1">
            <Label htmlFor="sc-applicant">
              {isAr ? "معرّف المتقدم (UUID)" : "Applicant ID (UUID)"}
            </Label>
            <Input
              id="sc-applicant"
              value={form.applicant_id}
              onChange={(e) => set("applicant_id")(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={!!editing}
              dir="ltr"
            />
          </div>

          {/* Evaluator email */}
          <div className="space-y-1">
            <Label htmlFor="sc-email">
              {isAr ? "البريد الإلكتروني للمقيّم" : "Evaluator Email"}
            </Label>
            <Input
              id="sc-email"
              type="email"
              value={form.evaluator_email}
              onChange={(e) => set("evaluator_email")(e.target.value)}
              dir="ltr"
            />
          </div>

          <Separator />

          {/* Rating grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="sc-overall">
                {isAr ? "التقييم العام" : "Overall Rating"}
              </Label>
              <RatingSelect
                id="sc-overall"
                value={form.overall_rating}
                onChange={set("overall_rating")}
                placeholder={isAr ? "اختر..." : "Select..."}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="sc-comm">
                {isAr ? "مهارات التواصل" : "Communication"}
              </Label>
              <RatingSelect
                id="sc-comm"
                value={form.communication_rating}
                onChange={set("communication_rating")}
                placeholder={isAr ? "اختر..." : "Select..."}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="sc-tech">
                {isAr ? "المهارات التقنية" : "Technical Skills"}
              </Label>
              <RatingSelect
                id="sc-tech"
                value={form.technical_rating}
                onChange={set("technical_rating")}
                placeholder={isAr ? "اختر..." : "Select..."}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="sc-culture">
                {isAr ? "الملاءمة الثقافية" : "Culture Fit"}
              </Label>
              <RatingSelect
                id="sc-culture"
                value={form.culture_fit_rating}
                onChange={set("culture_fit_rating")}
                placeholder={isAr ? "اختر..." : "Select..."}
              />
            </div>
          </div>

          <Separator />

          {/* Recommendation */}
          <div className="space-y-1">
            <Label htmlFor="sc-rec">
              {isAr ? "التوصية" : "Recommendation"}
            </Label>
            <Select
              value={form.recommendation}
              onValueChange={set("recommendation")}
            >
              <SelectTrigger id="sc-rec">
                <SelectValue
                  placeholder={isAr ? "اختر توصية..." : "Select recommendation..."}
                />
              </SelectTrigger>
              <SelectContent>
                {RECOMMENDATIONS.map((rec) => {
                  const meta = RECOMMENDATION_META[rec];
                  return (
                    <SelectItem key={rec} value={rec}>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${meta.className}`}>
                        {isAr ? meta.label_ar : meta.label_en}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Strengths */}
          <div className="space-y-1">
            <Label htmlFor="sc-strengths">
              {isAr ? "نقاط القوة" : "Strengths"}
            </Label>
            <Textarea
              id="sc-strengths"
              value={form.strengths}
              onChange={(e) => set("strengths")(e.target.value)}
              rows={2}
              dir={isAr ? "rtl" : "ltr"}
            />
          </div>

          {/* Weaknesses */}
          <div className="space-y-1">
            <Label htmlFor="sc-weaknesses">
              {isAr ? "نقاط الضعف" : "Weaknesses"}
            </Label>
            <Textarea
              id="sc-weaknesses"
              value={form.weaknesses}
              onChange={(e) => set("weaknesses")(e.target.value)}
              rows={2}
              dir={isAr ? "rtl" : "ltr"}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="sc-notes">
              {isAr ? "ملاحظات إضافية" : "Additional Notes"}
            </Label>
            <Textarea
              id="sc-notes"
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
              rows={2}
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
              ? "إنشاء التقييم"
              : "Create Scorecard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Applicant summary card
// ---------------------------------------------------------------------------

function ApplicantSummaryCard({
  summary,
  lang,
  onEdit,
  onDelete,
}: {
  summary: ApplicantSummary;
  lang: "ar" | "en";
  onEdit: (sc: ScorecardWithApplicant) => void;
  onDelete: (id: string) => void;
}) {
  const isAr = lang === "ar";
  const [expanded, setExpanded] = useState(false);

  const ratingBar = (value: number | null, label: string) => {
    if (value == null) return null;
    const pct = (value / 5) * 100;
    return (
      <div className="space-y-0.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span>{value.toFixed(1)}</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>
    );
  };

  const overallColor =
    summary.avgOverall == null
      ? "text-muted-foreground"
      : summary.avgOverall >= 4
      ? "text-green-600 dark:text-green-400"
      : summary.avgOverall >= 3
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{summary.applicant_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary.count} {isAr ? "تقييم" : summary.count === 1 ? "scorecard" : "scorecards"}
            </p>
          </div>
          {summary.avgOverall != null && (
            <div className={`text-right shrink-0 ${overallColor}`}>
              <p className="text-lg font-bold leading-none">
                {summary.avgOverall.toFixed(1)}
              </p>
              <p className="text-xs">{isAr ? "متوسط عام" : "avg overall"}</p>
            </div>
          )}
        </div>

        {/* Dimension bars */}
        <div className="mt-3 space-y-1.5">
          {ratingBar(
            summary.avgCommunication,
            isAr ? "التواصل" : "Communication"
          )}
          {ratingBar(summary.avgTechnical, isAr ? "التقني" : "Technical")}
          {ratingBar(summary.avgCultureFit, isAr ? "الثقافة" : "Culture Fit")}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full text-xs h-7 gap-1 text-muted-foreground"
          onClick={() => setExpanded((p) => !p)}
        >
          {expanded
            ? isAr
              ? "إخفاء التقييمات"
              : "Hide scorecards"
            : isAr
            ? "عرض التقييمات"
            : "Show scorecards"}
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </Button>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0">
          <Separator className="mb-3" />
          <div className="space-y-2">
            {summary.scorecards.map((sc) => (
              <div
                key={sc.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <RecommendationBadge value={sc.recommendation} lang={lang} />
                    <StarRating value={sc.overall_rating} />
                    {sc.evaluator_email && (
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {sc.evaluator_email}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sc.created_at).toLocaleDateString(
                      isAr ? "ar-SA" : "en-US"
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onEdit(sc)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(sc.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function InterviewScorecards() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";

  const { data: scorecards = [], isLoading } = useScorecardsQuery();
  const deleteMutation = useDeleteScorecardMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScorecardWithApplicant | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"table" | "summary">("table");

  const summaries = useApplicantSummaries(scorecards);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scorecards;
    return scorecards.filter(
      (sc) =>
        sc.applicants?.full_name?.toLowerCase().includes(q) ||
        sc.evaluator_email?.toLowerCase().includes(q) ||
        sc.recommendation?.toLowerCase().includes(q)
    );
  }, [scorecards, search]);

  const filteredSummaries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((s) => s.applicant_name.toLowerCase().includes(q));
  }, [summaries, search]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (sc: ScorecardWithApplicant) => {
    setEditing(sc);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (
      !confirm(isAr ? "هل تريد حذف هذا التقييم؟" : "Delete this scorecard?")
    )
      return;
    deleteMutation.mutate(id);
  };

  const tabClass = (tab: "table" | "summary") =>
    `px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
      activeTab === tab
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    }`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="w-5 h-5 text-amber-500" />
            {isAr ? "تقييمات المقابلة" : "Interview Scorecards"}
            <Badge variant="secondary" className="ml-1">
              {scorecards.length}
            </Badge>
          </CardTitle>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 h-8 text-sm w-52"
                placeholder={isAr ? "بحث..." : "Search..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                dir={isAr ? "rtl" : "ltr"}
              />
            </div>

            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="w-4 h-4" />
              {isAr ? "تقييم جديد" : "New Scorecard"}
            </Button>
          </div>
        </CardHeader>

        {/* Tab switcher */}
        <CardContent className="pt-0 pb-4">
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-4">
            <button
              className={tabClass("table")}
              onClick={() => setActiveTab("table")}
            >
              {isAr ? "جدول التقييمات" : "Scorecards Table"}
            </button>
            <button
              className={tabClass("summary")}
              onClick={() => setActiveTab("summary")}
            >
              {isAr ? "ملخص المتقدمين" : "Applicant Summary"}
            </button>
          </div>

          {/* Table view */}
          {activeTab === "table" && (
            <ScrollArea className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isAr ? "المتقدم" : "Applicant"}</TableHead>
                    <TableHead>{isAr ? "المقيّم" : "Evaluator"}</TableHead>
                    <TableHead>{isAr ? "عام" : "Overall"}</TableHead>
                    <TableHead>{isAr ? "تواصل" : "Comm."}</TableHead>
                    <TableHead>{isAr ? "تقني" : "Tech."}</TableHead>
                    <TableHead>{isAr ? "ثقافة" : "Culture"}</TableHead>
                    <TableHead>{isAr ? "التوصية" : "Recommendation"}</TableHead>
                    <TableHead>{isAr ? "التاريخ" : "Date"}</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-10 text-muted-foreground text-sm"
                      >
                        {isAr ? "جارٍ التحميل..." : "Loading..."}
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-10 text-muted-foreground text-sm"
                      >
                        {isAr
                          ? "لا توجد تقييمات بعد"
                          : "No scorecards yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((sc) => (
                      <TableRow key={sc.id}>
                        <TableCell className="font-medium text-sm max-w-[160px] truncate">
                          {sc.applicants?.full_name ?? (
                            <span className="text-muted-foreground text-xs font-mono">
                              {sc.applicant_id.slice(0, 8)}…
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                          {sc.evaluator_email ?? "—"}
                        </TableCell>
                        <TableCell>
                          <StarRating value={sc.overall_rating} />
                        </TableCell>
                        <TableCell>
                          <StarRating value={sc.communication_rating} />
                        </TableCell>
                        <TableCell>
                          <StarRating value={sc.technical_rating} />
                        </TableCell>
                        <TableCell>
                          <StarRating value={sc.culture_fit_rating} />
                        </TableCell>
                        <TableCell>
                          <RecommendationBadge
                            value={sc.recommendation}
                            lang={lang}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(sc.created_at).toLocaleDateString(
                            isAr ? "ar-SA" : "en-US"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(sc)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(sc.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Summary view */}
          {activeTab === "summary" && (
            <div>
              {isLoading ? (
                <p className="text-center py-10 text-muted-foreground text-sm">
                  {isAr ? "جارٍ التحميل..." : "Loading..."}
                </p>
              ) : filteredSummaries.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">
                  {isAr ? "لا توجد بيانات" : "No data"}
                </p>
              ) : (
                <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredSummaries.map((s) => (
                    <div key={s.applicant_id} className="p-1">
                      <ApplicantSummaryCard
                        summary={s}
                        lang={lang}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <ScorecardDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
        lang={lang}
      />
    </div>
  );
}
