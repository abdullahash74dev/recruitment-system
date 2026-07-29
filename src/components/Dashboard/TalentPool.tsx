import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useTalentPoolQuery,
  useCreateTalentPoolMutation,
  useUpdateTalentPoolMutation,
  useDeleteTalentPoolMutation,
  TalentPoolEntry,
  TalentPoolInsert,
} from "@/hooks/queries/useTalentPool";
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
  Users2,
  Plus,
  Pencil,
  Trash2,
  Star,
  Phone,
  Mail,
  Linkedin,
  Building2,
  MapPin,
  Calendar,
  AlertCircle,
  Search,
  Filter,
} from "lucide-react";

// ─── Types & Constants ────────────────────────────────────────────────────────

type Availability = TalentPoolEntry["availability"];

const AVAILABILITY_OPTIONS: Availability[] = [
  "immediate",
  "1_month",
  "3_months",
  "6_months",
  "not_looking",
];

interface AvailabilityMeta {
  labelAr: string;
  labelEn: string;
  badgeClass: string;
}

const AVAILABILITY_META: Record<Availability, AvailabilityMeta> = {
  immediate: {
    labelAr: "فوري",
    labelEn: "Immediate",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  "1_month": {
    labelAr: "خلال شهر",
    labelEn: "1 Month",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  "3_months": {
    labelAr: "خلال 3 أشهر",
    labelEn: "3 Months",
    badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  },
  "6_months": {
    labelAr: "خلال 6 أشهر",
    labelEn: "6 Months",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  not_looking: {
    labelAr: "غير متاح",
    labelEn: "Not Looking",
    badgeClass: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function availabilityLabel(av: Availability, ar: boolean) {
  const m = AVAILABILITY_META[av];
  return ar ? m.labelAr : m.labelEn;
}

function StarRating({ rating }: { rating: number | null }) {
  const filled = rating ?? 0;
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={
            n <= filled
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-gray-300 dark:text-gray-600"
          }
        />
      ))}
    </span>
  );
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function formatDate(dateStr: string | null, lang: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Default form state ───────────────────────────────────────────────────────

function emptyForm(): TalentPoolInsert {
  return {
    full_name: "",
    email: null,
    phone: null,
    linkedin: null,
    current_company: null,
    current_title: null,
    years_experience: null,
    skills: null,
    desired_salary_min: null,
    desired_salary_max: null,
    preferred_locations: null,
    availability: "not_looking",
    notes: null,
    source: null,
    tags: null,
    last_contacted_at: null,
    next_followup_at: null,
    rating: null,
    added_by: null,
  };
}

// ─── Candidate Dialog ─────────────────────────────────────────────────────────

interface CandidateDialogProps {
  open: boolean;
  onClose: () => void;
  initial: TalentPoolInsert;
  editId: string | null;
}

function CandidateDialog({ open, onClose, initial, editId }: CandidateDialogProps) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const createMutation = useCreateTalentPoolMutation();
  const updateMutation = useUpdateTalentPoolMutation();

  // The dialog is conditionally mounted by the parent (`{dialogOpen && ...}`),
  // so this initializer runs fresh on every open — no sync effect needed.
  const [form, setForm] = useState<TalentPoolInsert>(initial);

  function field(key: keyof TalentPoolInsert) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value || null }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) return;

    const payload = {
      ...form,
      desired_salary_min: form.desired_salary_min ? Number(form.desired_salary_min) : null,
      desired_salary_max: form.desired_salary_max ? Number(form.desired_salary_max) : null,
      rating: form.rating ? Number(form.rating) : null,
    };

    if (editId) {
      await updateMutation.mutateAsync({ id: editId, updates: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onClose();
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else handleOpen(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={ar ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>
            {editId
              ? ar ? "تعديل مرشح" : "Edit Candidate"
              : ar ? "إضافة مرشح جديد" : "Add New Candidate"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{ar ? "الاسم الكامل *" : "Full Name *"}</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "البريد الإلكتروني" : "Email"}</Label>
              <Input type="email" value={form.email ?? ""} onChange={field("email")} />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "رقم الهاتف" : "Phone"}</Label>
              <Input value={form.phone ?? ""} onChange={field("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label>LinkedIn</Label>
              <Input value={form.linkedin ?? ""} onChange={field("linkedin")} />
            </div>
          </div>

          <Separator />

          {/* Professional Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{ar ? "الشركة الحالية" : "Current Company"}</Label>
              <Input value={form.current_company ?? ""} onChange={field("current_company")} />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "المسمى الوظيفي" : "Current Title"}</Label>
              <Input value={form.current_title ?? ""} onChange={field("current_title")} />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "سنوات الخبرة" : "Years of Experience"}</Label>
              <Input value={form.years_experience ?? ""} onChange={field("years_experience")} />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "المصدر" : "Source"}</Label>
              <Input value={form.source ?? ""} onChange={field("source")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{ar ? "المهارات" : "Skills"}</Label>
            <Textarea rows={2} value={form.skills ?? ""} onChange={field("skills")} />
          </div>

          <Separator />

          {/* Salary & Locations */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{ar ? "الراتب المتوقع (أدنى)" : "Min Desired Salary"}</Label>
              <Input
                type="number"
                value={form.desired_salary_min ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    desired_salary_min: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "الراتب المتوقع (أقصى)" : "Max Desired Salary"}</Label>
              <Input
                type="number"
                value={form.desired_salary_max ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    desired_salary_max: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "المواقع المفضلة" : "Preferred Locations"}</Label>
              <Input value={form.preferred_locations ?? ""} onChange={field("preferred_locations")} />
            </div>
          </div>

          <Separator />

          {/* Availability, Rating, Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{ar ? "التوفر" : "Availability"}</Label>
              <Select
                value={form.availability}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, availability: v as Availability }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {availabilityLabel(opt, ar)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{ar ? "التقييم (1-5)" : "Rating (1-5)"}</Label>
              <Select
                value={form.rating?.toString() ?? ""}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, rating: v ? Number(v) : null }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={ar ? "اختر..." : "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{ar ? "بدون تقييم" : "No rating"}</SelectItem>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {"★".repeat(n)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{ar ? "الوسوم (Tags)" : "Tags"}</Label>
              <Input value={form.tags ?? ""} onChange={field("tags")} />
            </div>
          </div>

          {/* Follow-up dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{ar ? "تاريخ آخر تواصل" : "Last Contacted"}</Label>
              <Input
                type="date"
                value={form.last_contacted_at ? form.last_contacted_at.split("T")[0] : ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    last_contacted_at: e.target.value ? e.target.value : null,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "موعد المتابعة القادمة" : "Next Follow-up"}</Label>
              <Input
                type="date"
                value={form.next_followup_at ? form.next_followup_at.split("T")[0] : ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    next_followup_at: e.target.value ? e.target.value : null,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{ar ? "ملاحظات" : "Notes"}</Label>
            <Textarea rows={3} value={form.notes ?? ""} onChange={field("notes")} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isPending || !form.full_name.trim()}>
              {isPending
                ? ar ? "جارٍ الحفظ..." : "Saving..."
                : ar ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TalentPool() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const { data: candidates = [], isLoading } = useTalentPoolQuery();
  const deleteMutation = useDeleteTalentPoolMutation();

  const [search, setSearch] = useState("");
  const [filterAvailability, setFilterAvailability] = useState<"all" | Availability>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<TalentPoolEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Computed stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = candidates.length;
    const byAvailability = AVAILABILITY_OPTIONS.reduce<Record<string, number>>((acc, av) => {
      acc[av] = candidates.filter((c) => c.availability === av).length;
      return acc;
    }, {});
    const overdueFollowups = candidates.filter((c) => isOverdue(c.next_followup_at)).length;
    return { total, byAvailability, overdueFollowups };
  }, [candidates]);

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = candidates;
    if (filterAvailability !== "all") {
      list = list.filter((c) => c.availability === filterAvailability);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          (c.current_title ?? "").toLowerCase().includes(q) ||
          (c.current_company ?? "").toLowerCase().includes(q) ||
          (c.skills ?? "").toLowerCase().includes(q) ||
          (c.tags ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [candidates, filterAvailability, search]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openAdd() {
    setEditEntry(null);
    setDialogOpen(true);
  }

  function openEdit(entry: TalentPoolEntry) {
    setEditEntry(entry);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditEntry(null);
  }

  function handleDelete(id: string) {
    setDeleteConfirmId(id);
  }

  async function confirmDelete() {
    if (!deleteConfirmId) return;
    await deleteMutation.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  }

  // ── Build initial form for dialog ──────────────────────────────────────────

  const dialogInitial: TalentPoolInsert = editEntry
    ? {
        full_name: editEntry.full_name,
        email: editEntry.email,
        phone: editEntry.phone,
        linkedin: editEntry.linkedin,
        current_company: editEntry.current_company,
        current_title: editEntry.current_title,
        years_experience: editEntry.years_experience,
        skills: editEntry.skills,
        desired_salary_min: editEntry.desired_salary_min,
        desired_salary_max: editEntry.desired_salary_max,
        preferred_locations: editEntry.preferred_locations,
        availability: editEntry.availability,
        notes: editEntry.notes,
        source: editEntry.source,
        tags: editEntry.tags,
        last_contacted_at: editEntry.last_contacted_at,
        next_followup_at: editEntry.next_followup_at,
        rating: editEntry.rating,
        added_by: editEntry.added_by,
      }
    : emptyForm();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-1" dir={ar ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users2 className="text-primary" size={22} />
          <h2 className="text-xl font-bold">
            {ar ? "مجمع المواهب" : "Talent Pool"}
          </h2>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus size={16} />
          {ar ? "إضافة مرشح" : "Add Candidate"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">
              {ar ? "الإجمالي" : "Total"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-2xl font-bold text-primary">{stats.total}</p>
          </CardContent>
        </Card>

        {AVAILABILITY_OPTIONS.map((av) => (
          <Card
            key={av}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() =>
              setFilterAvailability((prev) => (prev === av ? "all" : av))
            }
          >
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs text-muted-foreground font-medium truncate">
                {availabilityLabel(av, ar)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-2xl font-bold">{stats.byAvailability[av] ?? 0}</p>
            </CardContent>
          </Card>
        ))}

        {stats.overdueFollowups > 0 && (
          <Card className="border-red-300 dark:border-red-700 col-span-2 md:col-span-1">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                <AlertCircle size={12} />
                {ar ? "متابعة متأخرة" : "Overdue"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.overdueFollowups}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            style={ar ? { right: "10px" } : { left: "10px" }}
          />
          <Input
            className={ar ? "pr-8" : "pl-8"}
            placeholder={ar ? "بحث بالاسم أو المهارة أو الشركة..." : "Search by name, skill, or company..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-muted-foreground shrink-0" />
          <Select
            value={filterAvailability}
            onValueChange={(v) => setFilterAvailability(v as "all" | Availability)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "جميع الحالات" : "All Statuses"}</SelectItem>
              {AVAILABILITY_OPTIONS.map((av) => (
                <SelectItem key={av} value={av}>
                  {availabilityLabel(av, ar)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ar ? "الاسم" : "Name"}</TableHead>
                  <TableHead>{ar ? "المسمى / الشركة" : "Title / Company"}</TableHead>
                  <TableHead>{ar ? "التوفر" : "Availability"}</TableHead>
                  <TableHead>{ar ? "التقييم" : "Rating"}</TableHead>
                  <TableHead>{ar ? "آخر تواصل" : "Last Contact"}</TableHead>
                  <TableHead>{ar ? "المتابعة القادمة" : "Next Follow-up"}</TableHead>
                  <TableHead>{ar ? "المهارات" : "Skills"}</TableHead>
                  <TableHead className="text-center">{ar ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      {ar ? "جارٍ التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      {ar ? "لا توجد نتائج" : "No candidates found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => {
                    const overdue = isOverdue(c.next_followup_at);
                    const meta = AVAILABILITY_META[c.availability];
                    return (
                      <TableRow
                        key={c.id}
                        className={overdue ? "bg-red-50/60 dark:bg-red-950/20" : undefined}
                      >
                        {/* Name & Contact */}
                        <TableCell>
                          <div className="font-medium">{c.full_name}</div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            {c.email && (
                              <a
                                href={`mailto:${c.email}`}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                              >
                                <Mail size={11} />
                                {c.email}
                              </a>
                            )}
                            {c.phone && (
                              <a
                                href={`tel:${c.phone}`}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                              >
                                <Phone size={11} />
                                {c.phone}
                              </a>
                            )}
                            {c.linkedin && (
                              <a
                                href={c.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                              >
                                <Linkedin size={11} />
                                LinkedIn
                              </a>
                            )}
                          </div>
                        </TableCell>

                        {/* Title / Company */}
                        <TableCell>
                          {c.current_title && (
                            <div className="text-sm font-medium">{c.current_title}</div>
                          )}
                          {c.current_company && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 size={11} />
                              {c.current_company}
                            </div>
                          )}
                          {c.preferred_locations && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin size={11} />
                              {c.preferred_locations}
                            </div>
                          )}
                        </TableCell>

                        {/* Availability */}
                        <TableCell>
                          <Badge className={`${meta.badgeClass} border-0 text-xs`}>
                            {availabilityLabel(c.availability, ar)}
                          </Badge>
                        </TableCell>

                        {/* Rating */}
                        <TableCell>
                          <StarRating rating={c.rating} />
                        </TableCell>

                        {/* Last Contact */}
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar size={12} className="text-muted-foreground" />
                            {formatDate(c.last_contacted_at, lang)}
                          </div>
                        </TableCell>

                        {/* Next Follow-up */}
                        <TableCell>
                          <div
                            className={`flex items-center gap-1 text-sm ${
                              overdue ? "text-red-600 dark:text-red-400 font-medium" : ""
                            }`}
                          >
                            {overdue && <AlertCircle size={12} />}
                            {formatDate(c.next_followup_at, lang)}
                          </div>
                        </TableCell>

                        {/* Skills */}
                        <TableCell>
                          <div className="max-w-[180px] truncate text-sm text-muted-foreground" title={c.skills ?? undefined}>
                            {c.skills ?? "—"}
                          </div>
                          {c.tags && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {c.tags.split(/[,،]/).slice(0, 3).map((tag) => (
                                <span
                                  key={tag.trim()}
                                  className="inline-block bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded"
                                >
                                  {tag.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openEdit(c)}
                              title={ar ? "تعديل" : "Edit"}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(c.id)}
                              title={ar ? "حذف" : "Delete"}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      {dialogOpen && (
        <CandidateDialog
          open={dialogOpen}
          onClose={closeDialog}
          initial={dialogInitial}
          editId={editEntry?.id ?? null}
        />
      )}

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <DialogContent dir={ar ? "rtl" : "ltr"} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{ar ? "تأكيد الحذف" : "Confirm Delete"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "هل أنت متأكد من حذف هذا المرشح؟ لا يمكن التراجع عن هذا الإجراء."
              : "Are you sure you want to delete this candidate? This action cannot be undone."}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? ar ? "جارٍ الحذف..." : "Deleting..."
                : ar ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
