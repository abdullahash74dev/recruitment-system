import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Edit2, Plus, Trash2, Phone, Video, Users, MapPin, Link2, Clock, Search, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfilesQuery } from "@/hooks/queries/useUsersAndRoles";
import {
  type Interview,
  type InterviewType,
  type InterviewStatus,
  type CreateInterviewParams,
  useInterviewsQuery,
  useCreateInterviewMutation,
  useUpdateInterviewMutation,
  useDeleteInterviewMutation,
} from "@/hooks/queries/useInterviews";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ApplicantOption {
  id: string;
  full_name: string;
  desired_position: string | null;
}

function useApplicantsSearch(search: string) {
  return useQuery({
    queryKey: ["applicants", "interviewSearch", search],
    queryFn: async (): Promise<ApplicantOption[]> => {
      const { data, error } = await supabase
        .from("applicants")
        .select("id, full_name, desired_position")
        .eq("is_archived", false)
        .ilike("full_name", `%${search}%`)
        .order("full_name")
        .limit(8);
      if (error) throw error;
      return (data ?? []) as ApplicantOption[];
    },
    enabled: search.trim().length >= 2,
    staleTime: 30 * 1000,
  });
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string, lang: "ar" | "en"): string {
  try {
    return new Date(iso).toLocaleString(lang === "ar" ? "ar-SA" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<InterviewStatus, string> = {
  scheduled:  "bg-blue-100   text-blue-800   border-blue-200   dark:bg-blue-900/30  dark:text-blue-300",
  completed:  "bg-green-100  text-green-800  border-green-200  dark:bg-green-900/30 dark:text-green-300",
  cancelled:  "bg-gray-100   text-gray-700   border-gray-200   dark:bg-gray-800     dark:text-gray-400",
  no_show:    "bg-red-100    text-red-800    border-red-200    dark:bg-red-900/30   dark:text-red-300",
};

function statusLabel(status: InterviewStatus, lang: "ar" | "en"): string {
  const labels: Record<InterviewStatus, { ar: string; en: string }> = {
    scheduled:  { ar: "مجدولة",   en: "Scheduled"  },
    completed:  { ar: "مكتملة",   en: "Completed"  },
    cancelled:  { ar: "ملغية",    en: "Cancelled"  },
    no_show:    { ar: "لم يحضر", en: "No Show"    },
  };
  return labels[status]?.[lang] ?? status;
}

function StatusBadge({ status, lang }: { status: InterviewStatus; lang: "ar" | "en" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {statusLabel(status, lang)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Type label + icon
// ---------------------------------------------------------------------------

function TypeCell({ type, lang }: { type: InterviewType; lang: "ar" | "en" }) {
  const config: Record<InterviewType, { icon: React.ReactNode; ar: string; en: string }> = {
    phone:     { icon: <Phone className="w-3.5 h-3.5" />,  ar: "هاتفية",  en: "Phone"     },
    video:     { icon: <Video className="w-3.5 h-3.5" />,  ar: "مرئية",   en: "Video"     },
    in_person: { icon: <Users className="w-3.5 h-3.5" />,  ar: "حضورية",  en: "In Person" },
  };
  const { icon, ar, en } = config[type] ?? { icon: null, ar: type, en: type };
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
      {icon}
      {lang === "ar" ? ar : en}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Default form values
// ---------------------------------------------------------------------------

interface FormState {
  applicant_id: string;
  applicant_name: string; // local display only
  interviewer_id: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string;
  meeting_link: string;
  type: InterviewType;
  status: InterviewStatus;
  notes: string;
}

const DEFAULT_FORM: FormState = {
  applicant_id: "",
  applicant_name: "",
  interviewer_id: "",
  scheduled_at: "",
  duration_minutes: 60,
  location: "",
  meeting_link: "",
  type: "in_person",
  status: "scheduled",
  notes: "",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function InterviewScheduler() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";

  // Queries
  const { data: interviews = [], isLoading } = useInterviewsQuery();
  const { data: profiles = [] } = useProfilesQuery();

  // Mutations
  const createMutation = useCreateInterviewMutation();
  const updateMutation = useUpdateInterviewMutation();
  const deleteMutation = useDeleteInterviewMutation();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  // Applicant search
  const [applicantSearch, setApplicantSearch] = useState("");
  const [showApplicantList, setShowApplicantList] = useState(false);
  const applicantSearchRef = useRef<HTMLDivElement>(null);
  const { data: applicantResults = [], isFetching: searchingApplicants } = useApplicantsSearch(applicantSearch);

  // Table filter
  const [tableSearch, setTableSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<InterviewStatus | "all">("all");
  const [filterType, setFilterType] = useState<InterviewType | "all">("all");

  // ---------------------------------------------------------------------------
  // Derived table rows
  // ---------------------------------------------------------------------------

  const filteredInterviews = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return interviews.filter((iv) => {
      if (filterStatus !== "all" && iv.status !== filterStatus) return false;
      if (filterType !== "all" && iv.type !== filterType) return false;
      if (q) {
        const name = iv.applicant?.full_name?.toLowerCase() ?? "";
        const pos  = iv.applicant?.desired_position?.toLowerCase() ?? "";
        const loc  = iv.location?.toLowerCase() ?? "";
        const iwr  = iv.interviewer?.display_name?.toLowerCase() ?? "";
        if (!name.includes(q) && !pos.includes(q) && !loc.includes(q) && !iwr.includes(q)) return false;
      }
      return true;
    });
  }, [interviews, tableSearch, filterStatus, filterType]);

  // ---------------------------------------------------------------------------
  // Dialog helpers
  // ---------------------------------------------------------------------------

  const openCreate = () => {
    setEditId(null);
    setForm(DEFAULT_FORM);
    setApplicantSearch("");
    setShowApplicantList(false);
    setDialogOpen(true);
  };

  const openEdit = (iv: Interview) => {
    setEditId(iv.id);
    setForm({
      applicant_id:     iv.applicant_id ?? "",
      applicant_name:   iv.applicant?.full_name ?? "",
      interviewer_id:   iv.interviewer_id ?? "",
      scheduled_at:     iv.scheduled_at ? toLocalDatetime(iv.scheduled_at) : "",
      duration_minutes: iv.duration_minutes ?? 60,
      location:         iv.location ?? "",
      meeting_link:     iv.meeting_link ?? "",
      type:             iv.type,
      status:           iv.status,
      notes:            iv.notes ?? "",
    });
    setApplicantSearch(iv.applicant?.full_name ?? "");
    setShowApplicantList(false);
    setDialogOpen(true);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const selectApplicant = (a: ApplicantOption) => {
    setField("applicant_id", a.id);
    setField("applicant_name", a.full_name);
    setApplicantSearch(a.full_name);
    setShowApplicantList(false);
  };

  const clearApplicant = () => {
    setField("applicant_id", "");
    setField("applicant_name", "");
    setApplicantSearch("");
  };

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = () => {
    if (!form.scheduled_at) {
      toast.error(isAr ? "حدد تاريخ ووقت المقابلة" : "Please select a date and time");
      return;
    }

    const payload: CreateInterviewParams = {
      applicant_id:     form.applicant_id   || null,
      interviewer_id:   form.interviewer_id  || null,
      scheduled_at:     new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      location:         form.location        || null,
      meeting_link:     form.meeting_link    || null,
      type:             form.type,
      status:           form.status,
      notes:            form.notes           || null,
    };

    if (editId) {
      const { applicant_id: _a, ...patch } = payload;
      updateMutation.mutate(
        { id: editId, patch },
        { onSuccess: () => setDialogOpen(false) }
      );
    } else {
      createMutation.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  };

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const handleDelete = (id: string) => {
    if (!confirm(isAr ? "هل تريد حذف هذه المقابلة؟" : "Delete this interview?")) return;
    deleteMutation.mutate(id);
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="w-5 h-5 text-primary" />
          {isAr ? "جدولة المقابلات" : "Interview Scheduling"}
        </CardTitle>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          {isAr ? "جدولة مقابلة" : "Schedule Interview"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={isAr ? "بحث بالاسم أو الموقع..." : "Search by name or location..."}
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="ps-8"
            />
          </div>

          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as InterviewStatus | "all")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={isAr ? "الحالة" : "Status"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? "كل الحالات" : "All Statuses"}</SelectItem>
              <SelectItem value="scheduled">{isAr ? "مجدولة" : "Scheduled"}</SelectItem>
              <SelectItem value="completed">{isAr ? "مكتملة" : "Completed"}</SelectItem>
              <SelectItem value="cancelled">{isAr ? "ملغية" : "Cancelled"}</SelectItem>
              <SelectItem value="no_show">{isAr ? "لم يحضر" : "No Show"}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={(v) => setFilterType(v as InterviewType | "all")}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={isAr ? "النوع" : "Type"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? "كل الأنواع" : "All Types"}</SelectItem>
              <SelectItem value="phone">{isAr ? "هاتفية" : "Phone"}</SelectItem>
              <SelectItem value="video">{isAr ? "مرئية" : "Video"}</SelectItem>
              <SelectItem value="in_person">{isAr ? "حضورية" : "In Person"}</SelectItem>
            </SelectContent>
          </Select>

          {(tableSearch || filterStatus !== "all" || filterType !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setTableSearch(""); setFilterStatus("all"); setFilterType("all"); }}
              className="gap-1 text-muted-foreground"
            >
              <X className="w-3.5 h-3.5" />
              {isAr ? "مسح" : "Clear"}
            </Button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {isAr ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : filteredInterviews.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {isAr ? "لا توجد مقابلات بعد" : "No interviews found"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isAr ? "المتقدم" : "Applicant"}</TableHead>
                  <TableHead>{isAr ? "المقابِل" : "Interviewer"}</TableHead>
                  <TableHead>{isAr ? "التاريخ والوقت" : "Date & Time"}</TableHead>
                  <TableHead>{isAr ? "النوع" : "Type"}</TableHead>
                  <TableHead>{isAr ? "المدة" : "Duration"}</TableHead>
                  <TableHead>{isAr ? "الموقع / الرابط" : "Location / Link"}</TableHead>
                  <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="w-[90px]">{isAr ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInterviews.map((iv) => (
                  <TableRow key={iv.id} className="align-top">
                    <TableCell>
                      <div className="font-medium text-sm">
                        {iv.applicant?.full_name ?? <span className="text-muted-foreground">—</span>}
                      </div>
                      {iv.applicant?.desired_position && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {iv.applicant.desired_position}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {iv.interviewer?.display_name || iv.interviewer?.email || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDateTime(iv.scheduled_at, lang)}
                    </TableCell>
                    <TableCell>
                      <TypeCell type={iv.type} lang={lang} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {iv.duration_minutes ?? 60} {isAr ? "د" : "min"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm max-w-[180px]">
                      {iv.location ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground truncate">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{iv.location}</span>
                        </span>
                      ) : iv.meeting_link ? (
                        <a
                          href={iv.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs truncate"
                        >
                          <Link2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{iv.meeting_link}</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={iv.status} lang={lang} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(iv)}
                          title={isAr ? "تعديل" : "Edit"}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(iv.id)}
                          disabled={deleteMutation.isPending}
                          title={isAr ? "حذف" : "Delete"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {isAr
            ? `إجمالي: ${filteredInterviews.length} من ${interviews.length} مقابلة`
            : `Showing ${filteredInterviews.length} of ${interviews.length} interviews`}
        </p>
      </CardContent>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              {editId
                ? (isAr ? "تعديل المقابلة" : "Edit Interview")
                : (isAr ? "جدولة مقابلة جديدة" : "Schedule New Interview")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Applicant Search */}
            <div className="space-y-1.5">
              <Label>{isAr ? "المتقدم" : "Applicant"}</Label>
              <div className="relative" ref={applicantSearchRef}>
                <div className="relative">
                  <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder={isAr ? "ابحث باسم المتقدم..." : "Search applicant name..."}
                    value={applicantSearch}
                    onChange={(e) => {
                      setApplicantSearch(e.target.value);
                      if (!e.target.value) clearApplicant();
                      setShowApplicantList(true);
                    }}
                    onFocus={() => setShowApplicantList(true)}
                    className="ps-8 pe-8"
                  />
                  {form.applicant_id && (
                    <button
                      type="button"
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={clearApplicant}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Suggestions dropdown */}
                {showApplicantList && applicantSearch.trim().length >= 2 && (
                  <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-md">
                    {searchingApplicants ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {isAr ? "جاري البحث..." : "Searching..."}
                      </div>
                    ) : applicantResults.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {isAr ? "لا نتائج" : "No results"}
                      </div>
                    ) : (
                      <ScrollArea className="max-h-48">
                        {applicantResults.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className="w-full text-start px-3 py-2 hover:bg-accent text-sm transition-colors"
                            onMouseDown={(e) => { e.preventDefault(); selectApplicant(a); }}
                          >
                            <div className="font-medium">{a.full_name}</div>
                            {a.desired_position && (
                              <div className="text-xs text-muted-foreground">{a.desired_position}</div>
                            )}
                          </button>
                        ))}
                      </ScrollArea>
                    )}
                  </div>
                )}
              </div>
              {form.applicant_id && (
                <p className="text-xs text-primary">
                  {isAr ? "تم الاختيار: " : "Selected: "}{form.applicant_name}
                </p>
              )}
            </div>

            {/* Interviewer */}
            <div className="space-y-1.5">
              <Label>{isAr ? "المقابِل" : "Interviewer"}</Label>
              <Select
                value={form.interviewer_id || "__none__"}
                onValueChange={(v) => setField("interviewer_id", v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isAr ? "اختر المقابِل..." : "Select interviewer..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{isAr ? "— بدون —" : "— None —"}</SelectItem>
                  {profiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name || p.email || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Date / Time + Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>{isAr ? "التاريخ والوقت" : "Date & Time"} *</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setField("scheduled_at", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? "المدة (دقيقة)" : "Duration (min)"}</Label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={form.duration_minutes}
                  onChange={(e) => setField("duration_minutes", Number(e.target.value))}
                />
              </div>
            </div>

            {/* Type + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isAr ? "نوع المقابلة" : "Interview Type"}</Label>
                <Select value={form.type} onValueChange={(v) => setField("type", v as InterviewType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_person">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {isAr ? "حضورية" : "In Person"}
                      </span>
                    </SelectItem>
                    <SelectItem value="phone">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        {isAr ? "هاتفية" : "Phone"}
                      </span>
                    </SelectItem>
                    <SelectItem value="video">
                      <span className="flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5" />
                        {isAr ? "مرئية" : "Video"}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{isAr ? "الحالة" : "Status"}</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v as InterviewStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">{isAr ? "مجدولة" : "Scheduled"}</SelectItem>
                    <SelectItem value="completed">{isAr ? "مكتملة" : "Completed"}</SelectItem>
                    <SelectItem value="cancelled">{isAr ? "ملغية" : "Cancelled"}</SelectItem>
                    <SelectItem value="no_show">{isAr ? "لم يحضر" : "No Show"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {isAr ? "الموقع" : "Location"}
              </Label>
              <Input
                placeholder={isAr ? "مثال: غرفة الاجتماعات A" : "e.g. Meeting Room A"}
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
              />
            </div>

            {/* Meeting Link */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" />
                {isAr ? "رابط الاجتماع" : "Meeting Link"}
              </Label>
              <Input
                type="url"
                placeholder="https://meet.google.com/..."
                value={form.meeting_link}
                onChange={(e) => setField("meeting_link", e.target.value)}
                dir="ltr"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>{isAr ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                placeholder={isAr ? "أي تعليمات أو ملاحظات إضافية..." : "Any additional notes or instructions..."}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 flex-row-reverse sm:flex-row">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isBusy}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSubmit} disabled={isBusy || !form.scheduled_at}>
              {isBusy
                ? (isAr ? "جاري الحفظ..." : "Saving...")
                : editId
                  ? (isAr ? "حفظ التعديلات" : "Save Changes")
                  : (isAr ? "جدولة المقابلة" : "Schedule Interview")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
