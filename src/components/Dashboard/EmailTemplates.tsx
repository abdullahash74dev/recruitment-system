import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MailPlus,
  Mail,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Eye,
  Send,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Megaphone,
  Braces,
} from "lucide-react";
import {
  useEmailTemplatesQuery,
  useCreateEmailTemplateMutation,
  useUpdateEmailTemplateMutation,
  useDeleteEmailTemplateMutation,
  useEmailCampaignsQuery,
  useCreateCampaignMutation,
  useUpdateCampaignMutation,
  useDeleteCampaignMutation,
  renderPreview,
  TEMPLATE_CATEGORIES,
  TEMPLATE_PLACEHOLDERS,
  type EmailTemplate,
  type EmailTemplateCategory,
  type EmailCampaign,
  type CampaignStatus,
} from "@/hooks/queries/useEmailTemplates";

// ---------------------------------------------------------------------------
// Labels & styles
// ---------------------------------------------------------------------------

const CATEGORY_LABEL = (c: EmailTemplateCategory, ar: boolean) =>
  ar
    ? {
        general: "عام",
        interview: "مقابلة",
        offer: "عرض وظيفي",
        rejection: "اعتذار",
        onboarding: "الانضمام",
        reminder: "تذكير",
      }[c]
    : {
        general: "General",
        interview: "Interview",
        offer: "Offer",
        rejection: "Rejection",
        onboarding: "Onboarding",
        reminder: "Reminder",
      }[c];

const CATEGORY_STYLE: Record<EmailTemplateCategory, string> = {
  general: "bg-muted text-muted-foreground",
  interview: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  offer: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejection: "bg-destructive/15 text-destructive",
  onboarding: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  reminder: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

const STATUS_LABEL = (s: CampaignStatus, ar: boolean) =>
  ar
    ? {
        draft: "مسودة",
        scheduled: "مجدولة",
        sending: "قيد الإرسال",
        completed: "مكتملة",
        cancelled: "ملغاة",
      }[s]
    : {
        draft: "Draft",
        scheduled: "Scheduled",
        sending: "Sending",
        completed: "Completed",
        cancelled: "Cancelled",
      }[s];

const STATUS_STYLE: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  sending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-destructive/15 text-destructive line-through",
};

// ---------------------------------------------------------------------------
// Form shapes
// ---------------------------------------------------------------------------

interface TemplateForm {
  name: string;
  category: EmailTemplateCategory;
  subject_ar: string;
  subject_en: string;
  body_ar: string;
  body_en: string;
  is_active: boolean;
}

const EMPTY_TEMPLATE: TemplateForm = {
  name: "",
  category: "general",
  subject_ar: "",
  subject_en: "",
  body_ar: "",
  body_en: "",
  is_active: true,
};

interface CampaignForm {
  name: string;
  template_id: string;
  target_filter: string;
  recipient_count: string;
  scheduled_at: string;
}

const EMPTY_CAMPAIGN: CampaignForm = {
  name: "",
  template_id: "",
  target_filter: "",
  recipient_count: "",
  scheduled_at: "",
};

export default function EmailTemplates() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const locale = ar ? "ar-EG" : "en-US";

  const { data: templates = [], isLoading: templatesLoading } = useEmailTemplatesQuery();
  const { data: campaigns = [], isLoading: campaignsLoading } = useEmailCampaignsQuery();
  const createTemplate = useCreateEmailTemplateMutation();
  const updateTemplate = useUpdateEmailTemplateMutation();
  const deleteTemplate = useDeleteEmailTemplateMutation();
  const createCampaign = useCreateCampaignMutation();
  const updateCampaign = useUpdateCampaignMutation();
  const deleteCampaign = useDeleteCampaignMutation();

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateForm>(EMPTY_TEMPLATE);
  // Preview is driven by the form when the editor is open, and by the stored
  // row when opened straight from a card — hence a snapshot, not an id.
  const [previewOf, setPreviewOf] = useState<TemplateForm | null>(null);

  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(EMPTY_CAMPAIGN);

  const templateById = useMemo(() => {
    const map = new Map<string, EmailTemplate>();
    templates.forEach((t) => map.set(t.id, t));
    return map;
  }, [templates]);

  const activeTemplates = useMemo(() => templates.filter((t) => t.is_active), [templates]);

  const stats = useMemo(
    () => ({
      templates: templates.length,
      activeCampaigns: campaigns.filter((c) => c.status === "scheduled" || c.status === "sending").length,
      sent: campaigns.reduce((sum, c) => sum + (c.sent_count ?? 0), 0),
    }),
    [templates, campaigns]
  );

  const formatDateTime = (value: string | null) =>
    value
      ? new Date(value).toLocaleString(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const templateName = (id: string | null) => {
    if (!id) return ar ? "— بدون قالب —" : "— No template —";
    return templateById.get(id)?.name ?? (ar ? "قالب محذوف" : "Deleted template");
  };

  // -------------------------------------------------------------------------
  // Template handlers
  // -------------------------------------------------------------------------

  const openCreateTemplate = () => {
    setEditingId(null);
    setTemplateForm(EMPTY_TEMPLATE);
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (t: EmailTemplate) => {
    setEditingId(t.id);
    setTemplateForm({
      name: t.name,
      category: t.category ?? "general",
      subject_ar: t.subject_ar ?? "",
      subject_en: t.subject_en ?? "",
      body_ar: t.body_ar ?? "",
      body_en: t.body_en ?? "",
      is_active: t.is_active ?? true,
    });
    setTemplateDialogOpen(true);
  };

  const submitTemplate = () => {
    const payload = {
      name: templateForm.name,
      category: templateForm.category,
      subject_ar: templateForm.subject_ar,
      subject_en: templateForm.subject_en,
      body_ar: templateForm.body_ar,
      body_en: templateForm.body_en,
      is_active: templateForm.is_active,
    };
    const done = { onSuccess: () => setTemplateDialogOpen(false) };
    if (editingId) updateTemplate.mutate({ id: editingId, patch: payload }, done);
    else createTemplate.mutate(payload, done);
  };

  // -------------------------------------------------------------------------
  // Campaign handlers
  // -------------------------------------------------------------------------

  const submitCampaign = () => {
    const parsedRecipients = parseInt(campaignForm.recipient_count, 10);
    createCampaign.mutate(
      {
        name: campaignForm.name,
        template_id: campaignForm.template_id || null,
        target_filter: campaignForm.target_filter,
        recipient_count: Number.isFinite(parsedRecipients) && parsedRecipients > 0 ? parsedRecipients : 0,
        // A date turns the campaign into a scheduled one; without it it stays a
        // draft the user promotes manually.
        scheduled_at: campaignForm.scheduled_at ? new Date(campaignForm.scheduled_at).toISOString() : null,
        status: campaignForm.scheduled_at ? "scheduled" : "draft",
      },
      {
        onSuccess: () => {
          setCampaignDialogOpen(false);
          setCampaignForm(EMPTY_CAMPAIGN);
        },
      }
    );
  };

  const schedule = (c: EmailCampaign) =>
    updateCampaign.mutate({
      id: c.id,
      patch: {
        status: "scheduled",
        // Nothing scheduled yet means "send now-ish" — default to the current
        // time so the row is never scheduled with a null date.
        scheduled_at: c.scheduled_at ?? new Date().toISOString(),
      },
    });

  const complete = (c: EmailCampaign) =>
    updateCampaign.mutate({
      id: c.id,
      patch: {
        status: "completed",
        completed_at: new Date().toISOString(),
        // No sender has reported per-recipient results, so assume the whole
        // audience was reached unless a count was already recorded.
        sent_count: c.sent_count ? c.sent_count : (c.recipient_count ?? 0),
        // Passed through so the hook can bump the template's use_count.
        template_id: c.template_id,
      },
    });

  const cancel = (c: EmailCampaign) =>
    updateCampaign.mutate({ id: c.id, patch: { status: "cancelled" } });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const previewBody = previewOf ? (ar ? previewOf.body_ar : previewOf.body_en) : "";
  const previewSubject = previewOf ? (ar ? previewOf.subject_ar : previewOf.subject_en) : "";

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------ */}
      {/* Stats                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-primary">{stats.templates.toLocaleString(locale)}</p>
            <p className="text-sm text-muted-foreground">{ar ? "إجمالي القوالب" : "Total Templates"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-blue-600">{stats.activeCampaigns.toLocaleString(locale)}</p>
            <p className="text-sm text-muted-foreground">{ar ? "حملات نشطة" : "Active Campaigns"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-emerald-600">{stats.sent.toLocaleString(locale)}</p>
            <p className="text-sm text-muted-foreground">{ar ? "رسائل مُرسلة" : "Emails Sent"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="gap-1">
            <Mail className="w-4 h-4" />
            {ar ? "القوالب" : "Templates"}
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1">
            <Megaphone className="w-4 h-4" />
            {ar ? "الحملات" : "Campaigns"}
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        {/* Templates                                                        */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <MailPlus className="w-5 h-5" />
                  {ar ? "قوالب البريد الإلكتروني" : "Email Templates"}
                </CardTitle>
                <Button size="sm" className="gap-1" onClick={openCreateTemplate}>
                  <Plus className="w-4 h-4" />
                  {ar ? "قالب جديد" : "New Template"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : templates.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  {ar ? "لا توجد قوالب بعد" : "No templates yet"}
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {templates.map((t) => {
                    const subject = (ar ? t.subject_ar : t.subject_en) || t.subject_ar || t.subject_en;
                    return (
                      <Card key={t.id} className={t.is_active ? "border-primary/40" : "border-border opacity-75"}>
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <p className="font-medium truncate">{t.name}</p>
                              <Badge className={CATEGORY_STYLE[t.category ?? "general"]}>
                                {CATEGORY_LABEL(t.category ?? "general", ar)}
                              </Badge>
                            </div>
                            <Switch
                              checked={!!t.is_active}
                              onCheckedChange={(checked) =>
                                updateTemplate.mutate({ id: t.id, patch: { is_active: checked } })
                              }
                              title={ar ? "تفعيل القالب" : "Template active"}
                            />
                          </div>

                          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                            {subject || (ar ? "بدون عنوان" : "No subject")}
                          </p>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              {ar
                                ? `استُخدم ${(t.use_count ?? 0).toLocaleString(locale)} مرة`
                                : `Used ${(t.use_count ?? 0).toLocaleString(locale)} time${(t.use_count ?? 0) === 1 ? "" : "s"}`}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 gap-1"
                                onClick={() =>
                                  setPreviewOf({
                                    name: t.name,
                                    category: t.category ?? "general",
                                    subject_ar: t.subject_ar ?? "",
                                    subject_en: t.subject_en ?? "",
                                    body_ar: t.body_ar ?? "",
                                    body_en: t.body_en ?? "",
                                    is_active: t.is_active ?? true,
                                  })
                                }
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {ar ? "معاينة" : "Preview"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => openEditTemplate(t)}
                                title={ar ? "تعديل" : "Edit"}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-destructive"
                                onClick={() => deleteTemplate.mutate(t.id)}
                                title={ar ? "حذف" : "Delete"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Campaigns                                                        */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5" />
                  {ar ? "حملات البريد" : "Email Campaigns"}
                </CardTitle>
                <Button size="sm" className="gap-1" onClick={() => setCampaignDialogOpen(true)}>
                  <Plus className="w-4 h-4" />
                  {ar ? "حملة جديدة" : "New Campaign"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <Send className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                <p className="text-muted-foreground">
                  {ar
                    ? "الإرسال الفعلي يتطلب مزود بريد بمفاتيح محفوظة كأسرار في وظائف Edge. حتى ذلك الحين تُدار الحملات هنا كسجل رسمي: يتم تحديث الحالة والأعداد يدوياً."
                    : "Actual delivery requires a mail provider whose keys live as edge-function secrets. Until then campaigns are tracked here as the system of record — statuses and counts are updated manually."}
                </p>
              </div>

              {campaignsLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : campaigns.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  {ar ? "لا توجد حملات بعد" : "No campaigns yet"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{ar ? "الحملة" : "Campaign"}</TableHead>
                        <TableHead>{ar ? "القالب" : "Template"}</TableHead>
                        <TableHead>{ar ? "الفلتر" : "Filter"}</TableHead>
                        <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                        <TableHead>{ar ? "المستلمون" : "Recipients"}</TableHead>
                        <TableHead>{ar ? "أُرسل" : "Sent"}</TableHead>
                        <TableHead>{ar ? "فشل" : "Failed"}</TableHead>
                        <TableHead>{ar ? "موعد الإرسال" : "Scheduled"}</TableHead>
                        <TableHead className="text-end">{ar ? "إجراءات" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium max-w-[14rem] truncate">{c.name}</TableCell>
                          <TableCell className="max-w-[12rem] truncate text-sm">
                            {templateName(c.template_id)}
                          </TableCell>
                          <TableCell>
                            {c.target_filter ? (
                              <code className="rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">
                                {c.target_filter}
                              </code>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_STYLE[c.status]}>{STATUS_LABEL(c.status, ar)}</Badge>
                          </TableCell>
                          <TableCell>{(c.recipient_count ?? 0).toLocaleString(locale)}</TableCell>
                          <TableCell className="text-emerald-600">
                            {(c.sent_count ?? 0).toLocaleString(locale)}
                          </TableCell>
                          <TableCell className={c.failed_count ? "text-destructive" : ""}>
                            {(c.failed_count ?? 0).toLocaleString(locale)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDateTime(c.scheduled_at)}
                          </TableCell>
                          <TableCell className="text-end">
                            <div className="flex items-center justify-end gap-1">
                              {c.status === "draft" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 gap-1"
                                  onClick={() => schedule(c)}
                                >
                                  <CalendarClock className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">{ar ? "جدولة" : "Schedule"}</span>
                                </Button>
                              )}
                              {(c.status === "scheduled" || c.status === "sending") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 gap-1"
                                  onClick={() => complete(c)}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">{ar ? "إكمال" : "Complete"}</span>
                                </Button>
                              )}
                              {c.status !== "completed" && c.status !== "cancelled" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 gap-1"
                                  onClick={() => cancel(c)}
                                  title={ar ? "إلغاء الحملة" : "Cancel campaign"}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-destructive"
                                onClick={() => deleteCampaign.mutate(c.id)}
                                title={ar ? "حذف" : "Delete"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------------ */}
      {/* Template editor                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={templateDialogOpen}
        onOpenChange={(open) => {
          setTemplateDialogOpen(open);
          if (!open) {
            setEditingId(null);
            setTemplateForm(EMPTY_TEMPLATE);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? (ar ? "تعديل القالب" : "Edit Template") : ar ? "قالب جديد" : "New Template"}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh] pe-3">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{ar ? "اسم القالب" : "Template Name"}</Label>
                  <Input
                    value={templateForm.name}
                    placeholder={ar ? "مثال: دعوة لمقابلة" : "e.g. Interview invitation"}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "التصنيف" : "Category"}</Label>
                  <Select
                    value={templateForm.category}
                    onValueChange={(v) =>
                      setTemplateForm((prev) => ({ ...prev, category: v as EmailTemplateCategory }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABEL(c, ar)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{ar ? "العنوان (عربي)" : "Subject (Arabic)"}</Label>
                  <Input
                    dir="rtl"
                    value={templateForm.subject_ar}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, subject_ar: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "العنوان (إنجليزي)" : "Subject (English)"}</Label>
                  <Input
                    dir="ltr"
                    value={templateForm.subject_en}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, subject_en: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{ar ? "نص الرسالة (عربي)" : "Body (Arabic)"}</Label>
                <Textarea
                  dir="rtl"
                  rows={6}
                  value={templateForm.body_ar}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, body_ar: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{ar ? "نص الرسالة (إنجليزي)" : "Body (English)"}</Label>
                <Textarea
                  dir="ltr"
                  rows={6}
                  value={templateForm.body_en}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, body_en: e.target.value }))}
                />
              </div>

              {/* Placeholder legend — mirrors TEMPLATE_PLACEHOLDERS so the list
                  can never drift from what the preview actually substitutes. */}
              <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <Braces className="w-3.5 h-3.5" />
                  {ar ? "المتغيرات المتاحة" : "Available placeholders"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_PLACEHOLDERS.map((p) => (
                    <code key={p} className="rounded bg-background px-1.5 py-0.5 text-xs border" dir="ltr">
                      {p}
                    </code>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? "تُستبدل هذه المتغيرات ببيانات المرشح عند الإرسال."
                    : "These are replaced with each recipient's data at send time."}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{ar ? "قالب مفعّل" : "Active template"}</p>
                  <p className="text-xs text-muted-foreground">
                    {ar
                      ? "القوالب غير المفعّلة لا تظهر عند إنشاء الحملات."
                      : "Inactive templates are hidden from the campaign picker."}
                  </p>
                </div>
                <Switch
                  checked={templateForm.is_active}
                  onCheckedChange={(checked) => setTemplateForm((prev) => ({ ...prev, is_active: checked }))}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="gap-1" onClick={() => setPreviewOf(templateForm)}>
              <Eye className="w-4 h-4" />
              {ar ? "معاينة" : "Preview"}
            </Button>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={submitTemplate}
              disabled={!templateForm.name.trim() || createTemplate.isPending || updateTemplate.isPending}
            >
              {(createTemplate.isPending || updateTemplate.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              )}
              {editingId ? (ar ? "حفظ التعديلات" : "Save Changes") : ar ? "إنشاء القالب" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Preview                                                            */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={!!previewOf} onOpenChange={(open) => !open && setPreviewOf(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{ar ? "معاينة الرسالة" : "Message Preview"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {ar
                ? "تُعرض المتغيرات مستبدَلة ببيانات تجريبية للتوضيح فقط."
                : "Placeholders are shown filled with sample data for illustration only."}
            </p>
            <div className="rounded-md border">
              <div className="border-b bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{ar ? "الموضوع" : "Subject"}</p>
                <p className="font-medium break-words" dir={ar ? "rtl" : "ltr"}>
                  {renderPreview(previewSubject, ar) || (ar ? "بدون عنوان" : "No subject")}
                </p>
              </div>
              <Separator />
              <ScrollArea className="max-h-[45vh]">
                <p
                  className="whitespace-pre-wrap p-4 text-sm leading-relaxed break-words"
                  dir={ar ? "rtl" : "ltr"}
                >
                  {renderPreview(previewBody, ar) ||
                    (ar ? "لا يوجد نص لهذه اللغة بعد" : "No body written for this language yet")}
                </p>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOf(null)}>
              {ar ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Campaign creator                                                   */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={campaignDialogOpen}
        onOpenChange={(open) => {
          setCampaignDialogOpen(open);
          if (!open) setCampaignForm(EMPTY_CAMPAIGN);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{ar ? "حملة بريد جديدة" : "New Email Campaign"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{ar ? "اسم الحملة" : "Campaign Name"}</Label>
              <Input
                value={campaignForm.name}
                placeholder={ar ? "مثال: متابعة المتقدمين الجدد" : "e.g. Follow up new applicants"}
                onChange={(e) => setCampaignForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{ar ? "القالب" : "Template"}</Label>
              <Select
                value={campaignForm.template_id}
                onValueChange={(v) => setCampaignForm((prev) => ({ ...prev, template_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ar ? "اختر قالباً مفعّلاً" : "Select an active template"} />
                </SelectTrigger>
                <SelectContent>
                  {activeTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeTemplates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {ar ? "لا توجد قوالب مفعّلة — أنشئ قالباً أولاً." : "No active templates — create one first."}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{ar ? "فلتر الجمهور" : "Target Filter"}</Label>
              <Input
                dir="ltr"
                value={campaignForm.target_filter}
                placeholder="status=new"
                onChange={(e) => setCampaignForm((prev) => ({ ...prev, target_filter: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "يُطبَّق الفلتر على المتقدمين وقت الإرسال، مثل: status=new أو desired_position=محاسب"
                  : "Applied to applicants at send time, e.g. status=new or desired_position=Accountant"}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{ar ? "عدد المستلمين المتوقع" : "Expected Recipients"}</Label>
                <Input
                  type="number"
                  min={0}
                  dir="ltr"
                  value={campaignForm.recipient_count}
                  placeholder="0"
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, recipient_count: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "موعد الإرسال (اختياري)" : "Send Date (optional)"}</Label>
                <Input
                  type="datetime-local"
                  value={campaignForm.scheduled_at}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, scheduled_at: e.target.value }))}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {ar
                ? "بدون موعد تُحفظ الحملة كمسودة يمكن جدولتها لاحقاً."
                : "Without a date the campaign is saved as a draft you can schedule later."}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={submitCampaign} disabled={!campaignForm.name.trim() || createCampaign.isPending}>
              {createCampaign.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {ar ? "إنشاء الحملة" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
