import { Fragment, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Send, Plus, Trash2, Loader2, AlertTriangle, Settings2, Save } from "lucide-react";
import {
  useMessagingSettingsQuery,
  useUpsertMessagingSettingsMutation,
  useMessageTemplatesQuery,
  useCreateMessageTemplateMutation,
  useDeleteMessageTemplateMutation,
  useMessageLogQuery,
  useSendMessageMutation,
  useMessagingRecipientsQuery,
  renderTemplate,
  type MessageChannel,
  type MessageStatus,
  type MessagingProvider,
} from "@/hooks/queries/useMessaging";

const STATUS_STYLE: Record<MessageStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  failed: "bg-destructive/15 text-destructive",
};

const STATUS_LABEL = (s: MessageStatus, ar: boolean) =>
  ar
    ? ({ queued: "في الانتظار", sent: "أُرسلت", delivered: "وصلت", failed: "فشلت" } as Record<MessageStatus, string>)[s] ?? s
    : ({ queued: "Queued", sent: "Sent", delivered: "Delivered", failed: "Failed" } as Record<MessageStatus, string>)[s] ?? s;

const CHANNEL_LABEL = (c: MessageChannel, ar: boolean) =>
  c === "whatsapp" ? (ar ? "واتساب" : "WhatsApp") : (ar ? "رسالة نصية" : "SMS");

const PROVIDER_LABEL: Record<MessagingProvider, { ar: string; en: string }> = {
  twilio: { ar: "Twilio", en: "Twilio" },
  unifonic: { ar: "يونيفونيك", en: "Unifonic" },
  msegat: { ar: "مسجات", en: "Msegat" },
  whatsapp_cloud: { ar: "واتساب كلاود API", en: "WhatsApp Cloud API" },
};

/**
 * SMS segmentation: Arabic (and any non-Latin) text is sent as UCS-2, which
 * fits far fewer characters per segment than GSM-7. Concatenated messages lose
 * a few characters per part to the UDH header.
 */
function segmentInfo(body: string) {
  // Anything above Latin-1 (Arabic included) forces the UCS-2 alphabet.
  const unicodeAlphabet = Array.from(body).some((ch) => ch.charCodeAt(0) > 0xff);
  const single = unicodeAlphabet ? 70 : 160;
  const multi = unicodeAlphabet ? 67 : 153;
  const length = body.length;
  const segments = length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi);
  const remaining = segments > 1 ? segments * multi - length : single - length;
  return { unicode: unicodeAlphabet, length, segments, remaining };
}

const formatDate = (value: string, ar: boolean) =>
  new Date(value).toLocaleString(ar ? "ar-SA" : "en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function MessagingCenter() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const { data: settings, isLoading: settingsLoading } = useMessagingSettingsQuery();
  const { data: templates = [], isLoading: templatesLoading } = useMessageTemplatesQuery();
  const { data: log = [], isLoading: logLoading } = useMessageLogQuery();
  const { data: recipients = [] } = useMessagingRecipientsQuery();

  const upsertSettings = useUpsertMessagingSettingsMutation();
  const createTemplate = useCreateMessageTemplateMutation();
  const deleteTemplate = useDeleteMessageTemplateMutation();
  const sendMessage = useSendMessageMutation();

  // ---- compose state ------------------------------------------------------
  const [applicantId, setApplicantId] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<MessageChannel>("sms");
  const [templateId, setTemplateId] = useState<string>("");
  const [body, setBody] = useState("");

  // ---- template dialog state ---------------------------------------------
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState<{
    name: string;
    channel: MessageChannel;
    body_ar: string;
    body_en: string;
  }>({ name: "", channel: "sms", body_ar: "", body_en: "" });

  // ---- settings form ------------------------------------------------------
  const [settingsDraft, setSettingsDraft] = useState<{
    provider: MessagingProvider;
    account_sid: string;
    sender_id: string;
    is_active: boolean;
    notes: string;
  } | null>(null);

  const settingsForm = settingsDraft ?? {
    provider: (settings?.provider ?? "twilio") as MessagingProvider,
    account_sid: settings?.account_sid ?? "",
    sender_id: settings?.sender_id ?? "",
    is_active: settings?.is_active ?? false,
    notes: settings?.notes ?? "",
  };
  const patchSettings = (patch: Partial<typeof settingsForm>) => setSettingsDraft({ ...settingsForm, ...patch });

  const stats = useMemo(() => {
    const sent = log.filter((m) => m.status === "sent" || m.status === "delivered").length;
    return {
      sent,
      delivered: log.filter((m) => m.status === "delivered").length,
      failed: log.filter((m) => m.status === "failed").length,
    };
  }, [log]);

  const selectedApplicant = recipients.find((r) => r.id === applicantId) ?? null;
  const seg = segmentInfo(body);
  const canSend = phone.trim().length >= 7 && body.trim().length > 0 && !sendMessage.isPending;

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    const raw = (ar ? template.body_ar || template.body_en : template.body_en || template.body_ar) ?? "";
    setBody(
      renderTemplate(raw, {
        name: selectedApplicant?.full_name ?? undefined,
        position: selectedApplicant?.desired_position ?? undefined,
      })
    );
    setChannel(template.channel);
  };

  const pickApplicant = (id: string) => {
    setApplicantId(id);
    const applicant = recipients.find((r) => r.id === id);
    if (!applicant) return;
    if (applicant.phone) setPhone(applicant.phone);
    setBody((prev) =>
      renderTemplate(prev, {
        name: applicant.full_name ?? undefined,
        position: applicant.desired_position ?? undefined,
      })
    );
  };

  const submitSend = () => {
    if (!canSend) return;
    sendMessage.mutate(
      {
        recipient_phone: phone.trim(),
        channel,
        body: body.trim(),
        applicant_id: applicantId || null,
      },
      {
        onSuccess: (result) => {
          if (result.ok) {
            setBody("");
            setTemplateId("");
          }
        },
      }
    );
  };

  const submitTemplate = () => {
    if (!templateForm.name.trim()) return;
    if (!templateForm.body_ar.trim() && !templateForm.body_en.trim()) return;
    createTemplate.mutate(
      {
        name: templateForm.name.trim(),
        channel: templateForm.channel,
        body_ar: templateForm.body_ar.trim() || null,
        body_en: templateForm.body_en.trim() || null,
      },
      {
        onSuccess: () => {
          setTemplateOpen(false);
          setTemplateForm({ name: "", channel: "sms", body_ar: "", body_en: "" });
        },
      }
    );
  };

  const saveSettings = () => {
    upsertSettings.mutate(
      {
        ...(settings?.id ? { id: settings.id } : {}),
        provider: settingsForm.provider,
        account_sid: settingsForm.account_sid.trim() || null,
        sender_id: settingsForm.sender_id.trim() || null,
        is_active: settingsForm.is_active,
        notes: settingsForm.notes.trim() || null,
      },
      { onSuccess: () => setSettingsDraft(null) }
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-blue-600">{stats.sent}</p>
            <p className="text-sm text-muted-foreground">{ar ? "إجمالي المُرسَل" : "Total Sent"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-emerald-600">{stats.delivered}</p>
            <p className="text-sm text-muted-foreground">{ar ? "تم التسليم" : "Delivered"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-destructive">{stats.failed}</p>
            <p className="text-sm text-muted-foreground">{ar ? "فشلت" : "Failed"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose">{ar ? "إرسال رسالة" : "Compose"}</TabsTrigger>
          <TabsTrigger value="templates">{ar ? "القوالب" : "Templates"}</TabsTrigger>
          <TabsTrigger value="log">{ar ? "السجل" : "Log"}</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------ */}
        {/* Compose                                                            */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="compose" className="mt-4 space-y-4">
          <Card className="border-amber-500/40 bg-amber-500/10">
            <CardContent className="flex items-start gap-3 pt-6">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  {ar ? "الإرسال يتطلب إعداد مفتاح المزوّد" : "Sending requires the provider token"}
                </p>
                <p className="text-amber-800/90 dark:text-amber-200/90">
                  {ar
                    ? "لا يُخزَّن مفتاح المزوّد في قاعدة البيانات. أضِفه كسرّ باسم SMS_AUTH_TOKEN في إعدادات دوال Supabase (Edge Functions) ثم انشر دالة send-sms. قبل ذلك ستُسجَّل الرسائل في السجل بحالة «فشلت»."
                    : "The provider token is never stored in the database. Add it as an edge-function secret named SMS_AUTH_TOKEN in your Supabase project and deploy the send-sms function. Until then, messages are recorded in the log as \"failed\"."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {ar ? "رسالة جديدة" : "New Message"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{ar ? "المتقدم (اختياري)" : "Applicant (optional)"}</Label>
                  <Select value={applicantId} onValueChange={pickApplicant}>
                    <SelectTrigger>
                      <SelectValue placeholder={ar ? "اختر متقدماً لتعبئة البيانات" : "Pick an applicant to autofill"} />
                    </SelectTrigger>
                    <SelectContent>
                      {recipients.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          {ar ? "لا يوجد متقدمون بأرقام هواتف" : "No applicants with phone numbers"}
                        </SelectItem>
                      ) : (
                        recipients.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {(r.full_name || (ar ? "بدون اسم" : "Unnamed")) + " — " + (r.phone ?? "")}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{ar ? "رقم المستلم" : "Recipient Phone"}</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+9665XXXXXXXX"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{ar ? "القناة" : "Channel"}</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as MessageChannel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sms">{ar ? "رسالة نصية (SMS)" : "SMS"}</SelectItem>
                      <SelectItem value="whatsapp">{ar ? "واتساب" : "WhatsApp"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{ar ? "القالب" : "Template"}</Label>
                  <Select value={templateId} onValueChange={applyTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder={ar ? "اختر قالباً جاهزاً" : "Choose a template"} />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          {ar ? "لا توجد قوالب" : "No templates"}
                        </SelectItem>
                      ) : (
                        templates
                          .filter((t) => t.is_active)
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} — {CHANNEL_LABEL(t.channel, ar)}
                            </SelectItem>
                          ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>{ar ? "نص الرسالة" : "Message Body"}</Label>
                  <span className="text-xs text-muted-foreground">
                    {ar
                      ? `${seg.length} حرف · ${seg.segments} مقطع · ${seg.remaining} متبقٍ${seg.unicode ? " · ترميز عربي" : ""}`
                      : `${seg.length} chars · ${seg.segments} segment${seg.segments === 1 ? "" : "s"} · ${seg.remaining} left${seg.unicode ? " · Unicode" : ""}`}
                  </span>
                </div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder={ar ? "اكتب الرسالة، أو اختر قالباً بالأعلى" : "Type the message, or pick a template above"}
                />
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? "المتغيرات المدعومة: {{name}} و {{position}} — تُستبدل تلقائياً عند اختيار متقدم."
                    : "Supported variables: {{name}} and {{position}} — replaced automatically when an applicant is selected."}
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={submitSend} disabled={!canSend} className="gap-2">
                  {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {ar ? "إرسال" : "Send"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Templates                                                          */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  {ar ? "قوالب الرسائل" : "Message Templates"}
                </CardTitle>
                <Button size="sm" className="gap-1" onClick={() => setTemplateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {ar ? "قالب جديد" : "New Template"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </div>
              ) : templates.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  {ar ? "لا توجد قوالب بعد" : "No templates yet"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{ar ? "الاسم" : "Name"}</TableHead>
                        <TableHead>{ar ? "القناة" : "Channel"}</TableHead>
                        <TableHead>{ar ? "النص" : "Body"}</TableHead>
                        <TableHead>{ar ? "المتغيرات" : "Variables"}</TableHead>
                        <TableHead className="w-16" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{CHANNEL_LABEL(t.channel, ar)}</Badge>
                          </TableCell>
                          <TableCell className="max-w-md text-sm text-muted-foreground">
                            <span className="line-clamp-2">{(ar ? t.body_ar || t.body_en : t.body_en || t.body_ar) ?? "—"}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground" dir="ltr">
                            {t.variables ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              disabled={deleteTemplate.isPending}
                              onClick={() => deleteTemplate.mutate(t.id)}
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
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Log                                                                */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="log" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {ar ? "سجل الرسائل" : "Message Log"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </div>
              ) : log.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  {ar ? "لم تُرسَل أي رسائل بعد" : "No messages sent yet"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{ar ? "التاريخ" : "Date"}</TableHead>
                        <TableHead>{ar ? "المستلم" : "Recipient"}</TableHead>
                        <TableHead>{ar ? "القناة" : "Channel"}</TableHead>
                        <TableHead>{ar ? "النص" : "Body"}</TableHead>
                        <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {log.map((m) => (
                        <Fragment key={m.id}>
                          <TableRow>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {formatDate(m.created_at, ar)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-medium" dir="ltr">
                              {m.recipient_phone}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{CHANNEL_LABEL(m.channel, ar)}</Badge>
                            </TableCell>
                            <TableCell className="max-w-md text-sm text-muted-foreground">
                              <span className="line-clamp-2">{m.body}</span>
                            </TableCell>
                            <TableCell>
                              <Badge className={STATUS_STYLE[m.status] ?? STATUS_STYLE.queued} variant="outline">
                                {STATUS_LABEL(m.status, ar)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                          {m.status === "failed" && m.error_detail ? (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={5} className="pt-0 text-xs text-destructive">
                                {(ar ? "سبب الفشل: " : "Failure reason: ") + m.error_detail}
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* -------------------------------------------------------------------- */}
      {/* Provider settings                                                    */}
      {/* -------------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {ar ? "إعدادات المزوّد" : "Provider Settings"}
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
                  <Label>{ar ? "المزوّد" : "Provider"}</Label>
                  <Select
                    value={settingsForm.provider}
                    onValueChange={(v) => patchSettings({ provider: v as MessagingProvider })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PROVIDER_LABEL) as MessagingProvider[]).map((p) => (
                        <SelectItem key={p} value={p}>
                          {ar ? PROVIDER_LABEL[p].ar : PROVIDER_LABEL[p].en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{ar ? "معرّف الحساب (Account SID)" : "Account SID"}</Label>
                  <Input
                    value={settingsForm.account_sid}
                    onChange={(e) => patchSettings({ account_sid: e.target.value })}
                    placeholder="ACxxxxxxxx"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{ar ? "اسم/رقم المُرسِل" : "Sender ID"}</Label>
                  <Input
                    value={settingsForm.sender_id}
                    onChange={(e) => patchSettings({ sender_id: e.target.value })}
                    placeholder={ar ? "مثال: COMPANY" : "e.g. COMPANY"}
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{ar ? "ملاحظات" : "Notes"}</Label>
                <Textarea
                  value={settingsForm.notes}
                  onChange={(e) => patchSettings({ notes: e.target.value })}
                  rows={2}
                  placeholder={ar ? "ملاحظات داخلية عن الحساب أو الحدود اليومية" : "Internal notes about the account or daily limits"}
                />
              </div>

              <Separator />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settingsForm.is_active}
                    onCheckedChange={(v) => patchSettings({ is_active: v })}
                    id="messaging-active"
                  />
                  <Label htmlFor="messaging-active" className="cursor-pointer">
                    {ar ? "تفعيل الإرسال" : "Enable sending"}
                  </Label>
                </div>
                <Button onClick={saveSettings} disabled={upsertSettings.isPending} className="gap-2">
                  {upsertSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {ar ? "حفظ الإعدادات" : "Save Settings"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {ar
                  ? "لا يتم تخزين مفتاح المزوّد هنا إطلاقاً — مكانه سرّ SMS_AUTH_TOKEN في دوال Supabase."
                  : "The provider auth token is never stored here — it belongs in the SMS_AUTH_TOKEN Supabase edge-function secret."}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* -------------------------------------------------------------------- */}
      {/* New template dialog                                                  */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{ar ? "قالب رسالة جديد" : "New Message Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{ar ? "اسم القالب" : "Template Name"}</Label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder={ar ? "مثال: دعوة لمقابلة" : "e.g. Interview invitation"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "القناة" : "Channel"}</Label>
              <Select
                value={templateForm.channel}
                onValueChange={(v) => setTemplateForm({ ...templateForm, channel: v as MessageChannel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">{ar ? "رسالة نصية (SMS)" : "SMS"}</SelectItem>
                  <SelectItem value="whatsapp">{ar ? "واتساب" : "WhatsApp"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{ar ? "النص بالعربية" : "Arabic Body"}</Label>
              <Textarea
                value={templateForm.body_ar}
                onChange={(e) => setTemplateForm({ ...templateForm, body_ar: e.target.value })}
                rows={3}
                dir="rtl"
                placeholder="مرحباً {{name}}، بخصوص وظيفة {{position}}..."
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "النص بالإنجليزية" : "English Body"}</Label>
              <Textarea
                value={templateForm.body_en}
                onChange={(e) => setTemplateForm({ ...templateForm, body_en: e.target.value })}
                rows={3}
                dir="ltr"
                placeholder="Hello {{name}}, regarding the {{position}} role..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={submitTemplate}
              disabled={
                createTemplate.isPending ||
                !templateForm.name.trim() ||
                (!templateForm.body_ar.trim() && !templateForm.body_en.trim())
              }
              className="gap-2"
            >
              {createTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {ar ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
