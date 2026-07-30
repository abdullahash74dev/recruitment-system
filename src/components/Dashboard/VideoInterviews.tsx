import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Video,
  Plus,
  Trash2,
  Loader2,
  Copy,
  ExternalLink,
  Settings2,
  Save,
  CalendarClock,
  CheckCircle2,
  UserX,
} from "lucide-react";
import {
  useVideoSettingsQuery,
  useUpsertVideoSettingsMutation,
  useVideoSessionsQuery,
  useCreateVideoSessionMutation,
  useUpdateVideoSessionMutation,
  useDeleteVideoSessionMutation,
  type VideoProvider,
  type VideoSession,
  type VideoSessionStatus,
} from "@/hooks/queries/useVideoInterviews";

// ---------------------------------------------------------------------------
// Labels & helpers
// ---------------------------------------------------------------------------

const PROVIDER_LABEL: Record<VideoProvider, { ar: string; en: string }> = {
  google_meet: { ar: "جوجل ميت", en: "Google Meet" },
  zoom: { ar: "زووم", en: "Zoom" },
  teams: { ar: "مايكروسوفت تيمز", en: "Microsoft Teams" },
  custom: { ar: "مزوّد مخصّص", en: "Custom Provider" },
};

const PROVIDER_STYLE: Record<VideoProvider, string> = {
  google_meet: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  zoom: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  teams: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  custom: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<VideoSessionStatus, { ar: string; en: string }> = {
  scheduled: { ar: "مجدولة", en: "Scheduled" },
  live: { ar: "جارية الآن", en: "Live" },
  completed: { ar: "مكتملة", en: "Completed" },
  cancelled: { ar: "ملغاة", en: "Cancelled" },
  no_show: { ar: "لم يحضر", en: "No Show" },
};

const STATUS_STYLE: Record<VideoSessionStatus, string> = {
  scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  live: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/15 text-destructive",
  no_show: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

const PROVIDERS = Object.keys(PROVIDER_LABEL) as VideoProvider[];
const STATUSES = Object.keys(STATUS_LABEL) as VideoSessionStatus[];

const ONE_HOUR_MS = 60 * 60 * 1000;

const formatDateTime = (value: string, ar: boolean) =>
  new Date(value).toLocaleString(ar ? "ar-SA" : "en-GB", {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** `datetime-local` speaks local wall-clock time, the DB speaks UTC ISO. */
function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

/** Tomorrow at 10:00 local — a sane default for a freshly opened dialog. */
function defaultScheduledAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toDateTimeLocalValue(d);
}

/** Human countdown for sessions that are about to start. */
function minutesUntil(scheduledAt: string, now: number): number {
  return Math.round((new Date(scheduledAt).getTime() - now) / 60000);
}

interface SessionFormState {
  applicant_name: string;
  scheduled_at: string;
  provider: VideoProvider;
  duration_minutes: string;
  meeting_link: string;
  notes: string;
}

const emptyForm = (provider: VideoProvider, duration: number): SessionFormState => ({
  applicant_name: "",
  scheduled_at: defaultScheduledAt(),
  provider,
  duration_minutes: String(duration),
  meeting_link: "",
  notes: "",
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideoInterviews() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const { data: settings, isLoading: settingsLoading } = useVideoSettingsQuery();
  const { data: sessions = [], isLoading: sessionsLoading } = useVideoSessionsQuery();

  const upsertSettings = useUpsertVideoSettingsMutation();
  const createSession = useCreateVideoSessionMutation();
  const updateSession = useUpdateVideoSessionMutation();
  const deleteSession = useDeleteVideoSessionMutation();

  // "Starting soon" highlighting is time-dependent — re-render every minute so
  // a card lights up without the user reloading the page.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const defaultProvider = (settings?.provider ?? "google_meet") as VideoProvider;
  const defaultDuration = settings?.default_duration_minutes ?? 45;

  // ---- create dialog ------------------------------------------------------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SessionFormState>(() => emptyForm("google_meet", 45));
  const patchForm = (patch: Partial<SessionFormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const openDialog = () => {
    setForm(emptyForm(defaultProvider, defaultDuration));
    setDialogOpen(true);
  };

  // ---- settings form ------------------------------------------------------
  const [settingsDraft, setSettingsDraft] = useState<{
    provider: VideoProvider;
    default_duration_minutes: string;
    auto_generate_link: boolean;
    custom_link_pattern: string;
  } | null>(null);

  const settingsForm = settingsDraft ?? {
    provider: defaultProvider,
    default_duration_minutes: String(defaultDuration),
    auto_generate_link: settings?.auto_generate_link ?? true,
    custom_link_pattern: settings?.custom_link_pattern ?? "",
  };
  const patchSettings = (patch: Partial<typeof settingsForm>) => setSettingsDraft({ ...settingsForm, ...patch });

  // ---- per-row recording url drafts ---------------------------------------
  const [recordingDrafts, setRecordingDrafts] = useState<Record<string, string>>({});

  const stats = useMemo(() => {
    const upcoming = sessions.filter(
      (s) => (s.status === "scheduled" || s.status === "live") && new Date(s.scheduled_at).getTime() >= now
    ).length;
    return {
      upcoming,
      completed: sessions.filter((s) => s.status === "completed").length,
      noShows: sessions.filter((s) => s.status === "no_show").length,
    };
  }, [sessions, now]);

  /** Future, still-active sessions, soonest first. */
  const upcomingSessions = useMemo(
    () =>
      sessions
        .filter(
          (s) =>
            (s.status === "scheduled" || s.status === "live") &&
            new Date(s.scheduled_at).getTime() >= now - ONE_HOUR_MS
        )
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [sessions, now]
  );

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(ar ? "تم نسخ رابط الاجتماع" : "Meeting link copied");
    } catch {
      toast.error(ar ? "تعذّر نسخ الرابط" : "Could not copy the link");
    }
  };

  const submitSession = () => {
    if (!form.applicant_name.trim() || !form.scheduled_at) return;
    const duration = Number(form.duration_minutes);
    createSession.mutate(
      {
        applicant_name: form.applicant_name.trim(),
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        provider: form.provider,
        duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : defaultDuration,
        meeting_link: form.meeting_link.trim() || null,
        notes: form.notes.trim() || null,
      },
      { onSuccess: () => setDialogOpen(false) }
    );
  };

  const saveSettings = () => {
    const duration = Number(settingsForm.default_duration_minutes);
    upsertSettings.mutate(
      {
        ...(settings?.id ? { id: settings.id } : {}),
        provider: settingsForm.provider,
        default_duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : 45,
        auto_generate_link: settingsForm.auto_generate_link,
        custom_link_pattern: settingsForm.custom_link_pattern.trim() || null,
        is_active: true,
      },
      { onSuccess: () => setSettingsDraft(null) }
    );
  };

  const commitRecordingUrl = (session: VideoSession) => {
    const draft = recordingDrafts[session.id];
    if (draft === undefined) return;
    const next = draft.trim() || null;
    if (next === (session.recording_url ?? null)) return;
    updateSession.mutate({ id: session.id, patch: { recording_url: next } });
  };

  const canSubmit = form.applicant_name.trim().length > 0 && form.scheduled_at.length > 0 && !createSession.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Video className="h-5 w-5" />
          {ar ? "مقابلات الفيديو" : "Video Interviews"}
        </h2>
        <Button className="gap-1" onClick={openDialog}>
          <Plus className="h-4 w-4" />
          {ar ? "جلسة جديدة" : "New Session"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <CalendarClock className="mx-auto mb-2 h-5 w-5 text-blue-600" />
            <p className="text-3xl font-bold text-blue-600">{stats.upcoming}</p>
            <p className="text-sm text-muted-foreground">{ar ? "جلسات قادمة" : "Upcoming Sessions"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-600" />
            <p className="text-3xl font-bold text-emerald-600">{stats.completed}</p>
            <p className="text-sm text-muted-foreground">{ar ? "مكتملة" : "Completed"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <UserX className="mx-auto mb-2 h-5 w-5 text-amber-600" />
            <p className="text-3xl font-bold text-amber-600">{stats.noShows}</p>
            <p className="text-sm text-muted-foreground">{ar ? "لم يحضروا" : "No Shows"}</p>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Upcoming                                                           */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            {ar ? "الجلسات القادمة" : "Upcoming Sessions"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            </div>
          ) : upcomingSessions.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              {ar ? "لا توجد جلسات قادمة" : "No upcoming sessions"}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {upcomingSessions.map((s) => {
                const minutes = minutesUntil(s.scheduled_at, now);
                // Anything inside the next hour (or already started) is hot.
                const startingSoon = minutes <= 60;
                return (
                  <Card
                    key={s.id}
                    className={
                      startingSoon
                        ? "border-2 border-emerald-500 bg-emerald-500/5 shadow-sm"
                        : "border border-border"
                    }
                  >
                    <CardContent className="space-y-3 pt-6">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {s.applicant_name || (ar ? "بدون اسم" : "Unnamed")}
                          </p>
                          <p className="text-sm text-muted-foreground">{formatDateTime(s.scheduled_at, ar)}</p>
                        </div>
                        <Badge variant="outline" className={PROVIDER_STYLE[s.provider]}>
                          {ar ? PROVIDER_LABEL[s.provider].ar : PROVIDER_LABEL[s.provider].en}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className={STATUS_STYLE[s.status]}>
                          {ar ? STATUS_LABEL[s.status].ar : STATUS_LABEL[s.status].en}
                        </Badge>
                        <span>
                          {ar ? `${s.duration_minutes ?? 45} دقيقة` : `${s.duration_minutes ?? 45} min`}
                        </span>
                        {startingSoon ? (
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            {minutes <= 0
                              ? ar
                                ? "بدأت الآن"
                                : "Starting now"
                              : ar
                                ? `تبدأ خلال ${minutes} دقيقة`
                                : `Starts in ${minutes} min`}
                          </span>
                        ) : null}
                      </div>

                      {s.passcode ? (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {(ar ? "رمز الدخول: " : "Passcode: ") + s.passcode}
                        </p>
                      ) : null}

                      <div className="flex items-center gap-2">
                        <Button asChild className="flex-1 gap-2">
                          <a href={s.meeting_link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            {ar ? "انضم للمقابلة" : "Join Meeting"}
                          </a>
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyLink(s.meeting_link)}
                          aria-label={ar ? "نسخ الرابط" : "Copy link"}
                          title={ar ? "نسخ الرابط" : "Copy link"}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* All sessions                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            {ar ? "كل الجلسات" : "All Sessions"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              {ar ? "لم تُجدول أي مقابلة فيديو بعد" : "No video sessions scheduled yet"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "المتقدم" : "Applicant"}</TableHead>
                    <TableHead>{ar ? "الموعد" : "Scheduled"}</TableHead>
                    <TableHead>{ar ? "المزوّد" : "Provider"}</TableHead>
                    <TableHead>{ar ? "الرابط" : "Link"}</TableHead>
                    <TableHead className="w-44">{ar ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="w-64">{ar ? "رابط التسجيل" : "Recording URL"}</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {s.applicant_name || (ar ? "بدون اسم" : "Unnamed")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateTime(s.scheduled_at, ar)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={PROVIDER_STYLE[s.provider]}>
                          {ar ? PROVIDER_LABEL[s.provider].ar : PROVIDER_LABEL[s.provider].en}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" asChild>
                            <a
                              href={s.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={ar ? "فتح الرابط" : "Open link"}
                              title={ar ? "فتح الرابط" : "Open link"}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => copyLink(s.meeting_link)}
                            aria-label={ar ? "نسخ الرابط" : "Copy link"}
                            title={ar ? "نسخ الرابط" : "Copy link"}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={s.status}
                          onValueChange={(v) =>
                            updateSession.mutate({ id: s.id, patch: { status: v as VideoSessionStatus } })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((st) => (
                              <SelectItem key={st} value={st}>
                                {ar ? STATUS_LABEL[st].ar : STATUS_LABEL[st].en}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8"
                          dir="ltr"
                          placeholder="https://..."
                          value={recordingDrafts[s.id] ?? s.recording_url ?? ""}
                          onChange={(e) => setRecordingDrafts({ ...recordingDrafts, [s.id]: e.target.value })}
                          onBlur={() => commitRecordingUrl(s)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          disabled={deleteSession.isPending}
                          onClick={() => deleteSession.mutate(s.id)}
                          aria-label={ar ? "حذف" : "Delete"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Settings                                                           */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {ar ? "إعدادات الاجتماعات" : "Meeting Settings"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{ar ? "المزوّد الافتراضي" : "Default Provider"}</Label>
                  <Select
                    value={settingsForm.provider}
                    onValueChange={(v) => patchSettings({ provider: v as VideoProvider })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {ar ? PROVIDER_LABEL[p].ar : PROVIDER_LABEL[p].en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{ar ? "المدة الافتراضية (دقيقة)" : "Default Duration (minutes)"}</Label>
                  <Input
                    type="number"
                    min={5}
                    step={5}
                    value={settingsForm.default_duration_minutes}
                    onChange={(e) => patchSettings({ default_duration_minutes: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{ar ? "نمط الرابط المخصّص" : "Custom Link Pattern"}</Label>
                  <Input
                    dir="ltr"
                    value={settingsForm.custom_link_pattern}
                    onChange={(e) => patchSettings({ custom_link_pattern: e.target.value })}
                    placeholder="https://meet.example.com/{id}"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Switch
                    id="video-auto-link"
                    checked={settingsForm.auto_generate_link}
                    onCheckedChange={(v) => patchSettings({ auto_generate_link: v })}
                  />
                  <Label htmlFor="video-auto-link" className="cursor-pointer">
                    {ar ? "توليد رابط الاجتماع تلقائياً" : "Auto-generate meeting link"}
                  </Label>
                </div>
                <Button onClick={saveSettings} disabled={upsertSettings.isPending} className="gap-2">
                  {upsertSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {ar ? "حفظ الإعدادات" : "Save Settings"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {ar
                  ? "الروابط المولّدة تلقائياً هي روابط «ابدأ اجتماعاً» لدى المزوّد وليست غرفاً محجوزة مسبقاً. إنشاء اجتماع حقيقي عبر واجهات جوجل أو زووم أو تيمز يتطلب اعتمادات OAuth من جهة الخادم؛ حتى ذلك الحين يمكنك لصق رابط الاجتماع يدوياً."
                  : "Auto-generated links are provider \"start a meeting\" URLs, not pre-booked rooms. Creating a real meeting through the Google, Zoom, or Teams APIs requires server-side OAuth credentials; until then you can paste a meeting link manually."}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Create dialog                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{ar ? "جدولة مقابلة فيديو" : "Schedule Video Interview"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{ar ? "اسم المتقدم" : "Applicant Name"}</Label>
              <Input
                value={form.applicant_name}
                onChange={(e) => patchForm({ applicant_name: e.target.value })}
                placeholder={ar ? "مثال: أحمد العتيبي" : "e.g. Ahmed Alotaibi"}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{ar ? "الموعد" : "Date & Time"}</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => patchForm({ scheduled_at: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{ar ? "المدة (دقيقة)" : "Duration (minutes)"}</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={form.duration_minutes}
                  onChange={(e) => patchForm({ duration_minutes: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{ar ? "المزوّد" : "Provider"}</Label>
              <Select value={form.provider} onValueChange={(v) => patchForm({ provider: v as VideoProvider })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {ar ? PROVIDER_LABEL[p].ar : PROVIDER_LABEL[p].en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{ar ? "رابط الاجتماع (اختياري)" : "Meeting Link (optional)"}</Label>
              <Input
                dir="ltr"
                value={form.meeting_link}
                onChange={(e) => patchForm({ meeting_link: e.target.value })}
                placeholder="https://meet.google.com/abc-defg-hij"
              />
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "اتركه فارغاً ليُولَّد رابط المزوّد تلقائياً."
                  : "Leave empty to generate the provider link automatically."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{ar ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => patchForm({ notes: e.target.value })}
                rows={3}
                placeholder={ar ? "محاور المقابلة، الحاضرون، أي تجهيزات..." : "Agenda, attendees, prep notes..."}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={submitSession} disabled={!canSubmit} className="gap-2">
              {createSession.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {ar ? "جدولة" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
