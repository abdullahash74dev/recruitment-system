import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plug,
  Plus,
  Loader2,
  Trash2,
  Send,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Webhook as WebhookIcon,
  Activity,
} from "lucide-react";
import {
  useIntegrationsQuery,
  useUpdateIntegrationMutation,
  useWebhooksQuery,
  useCreateWebhookMutation,
  useUpdateWebhookMutation,
  useDeleteWebhookMutation,
  useWebhookDeliveriesQuery,
  useTestWebhookMutation,
  INTEGRATION_CATEGORIES,
  CATEGORY_LABEL,
  WEBHOOK_EVENTS,
  EVENT_LABEL,
  type Integration,
  type IntegrationCategory,
  type WebhookEventType,
} from "@/hooks/queries/useIntegrations";

const EVENT_STYLE: Record<WebhookEventType, string> = {
  applicant_created: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  status_changed: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  interview_scheduled: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  offer_sent: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  candidate_hired: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

interface WebhookForm {
  name: string;
  target_url: string;
  event_type: WebhookEventType;
  secret_hint: string;
}

const EMPTY_FORM: WebhookForm = {
  name: "",
  target_url: "",
  event_type: "applicant_created",
  secret_hint: "",
};

/** Keeps long endpoint URLs from blowing out the table width. */
const truncateUrl = (url: string, max = 44) => (url.length > max ? `${url.slice(0, max)}…` : url);

export default function IntegrationsHub() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const locale = ar ? "ar-EG" : "en-US";

  const { data: integrations = [], isLoading: integrationsLoading } = useIntegrationsQuery();
  const { data: webhooks = [], isLoading: webhooksLoading } = useWebhooksQuery();
  const { data: deliveries = [], isLoading: deliveriesLoading } = useWebhookDeliveriesQuery();
  const updateIntegration = useUpdateIntegrationMutation();
  const createWebhook = useCreateWebhookMutation();
  const updateWebhook = useUpdateWebhookMutation();
  const deleteWebhook = useDeleteWebhookMutation();
  const testWebhook = useTestWebhookMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<WebhookForm>(EMPTY_FORM);
  // Which row's test button is spinning — the mutation is shared across rows.
  const [testingId, setTestingId] = useState<string | null>(null);

  /** Only categories that actually have seeded services get a section. */
  const grouped = useMemo(() => {
    const byCategory = new Map<IntegrationCategory, Integration[]>();
    integrations.forEach((item) => {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    });
    return INTEGRATION_CATEGORIES.filter((c) => byCategory.has(c)).map((category) => ({
      category,
      items: byCategory.get(category) ?? [],
    }));
  }, [integrations]);

  const webhookById = useMemo(() => new Map(webhooks.map((w) => [w.id, w])), [webhooks]);

  const stats = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return {
      connected: integrations.filter((i) => i.is_connected).length,
      activeWebhooks: webhooks.filter((w) => w.is_active).length,
      deliveriesToday: deliveries.filter((d) => new Date(d.delivered_at) >= startOfToday).length,
    };
  }, [integrations, webhooks, deliveries]);

  const formatDateTime = (value: string | null) =>
    value
      ? new Date(value).toLocaleString(locale, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const submitWebhook = () => {
    createWebhook.mutate(
      {
        name: form.name,
        target_url: form.target_url,
        event_type: form.event_type,
        secret_hint: form.secret_hint,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setForm(EMPTY_FORM);
        },
      }
    );
  };

  const runTest = (id: string) => {
    const webhook = webhookById.get(id);
    if (!webhook) return;
    setTestingId(id);
    testWebhook.mutate(webhook, { onSettled: () => setTestingId(null) });
  };

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------ */}
      {/* Stats                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-primary">{stats.connected}</p>
            <p className="text-sm text-muted-foreground">{ar ? "تكاملات مفعّلة" : "Connected Integrations"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-emerald-600">{stats.activeWebhooks}</p>
            <p className="text-sm text-muted-foreground">{ar ? "Webhooks نشطة" : "Active Webhooks"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-blue-600">{stats.deliveriesToday.toLocaleString(locale)}</p>
            <p className="text-sm text-muted-foreground">{ar ? "محاولات إرسال اليوم" : "Deliveries Today"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="integrations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="integrations" className="gap-1">
            <Plug className="w-4 h-4" />
            {ar ? "التكاملات" : "Integrations"}
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1">
            <WebhookIcon className="w-4 h-4" />
            Webhooks
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        {/* Integrations                                                     */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                <div className="space-y-1 text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {ar ? "التفعيل هنا يسجّل النية فقط" : "Toggling here records intent only"}
                  </p>
                  <p>
                    {ar
                      ? "تفعيل أي تكامل من هذه الصفحة يسجّل رغبتك في استخدامه ولا ينشئ اتصالاً فعلياً. بيانات الاعتماد (مفاتيح API والرموز السرية) يجب إضافتها كأسرار في وظائف Edge لدى Supabase حتى لا تصل إلى المتصفح إطلاقاً."
                      : "Enabling an integration on this page records that you intend to use it — it does not establish a live connection. The actual API credentials (keys and tokens) must be added as Supabase edge-function secrets so they never reach the browser."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {integrationsLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : integrations.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              {ar ? "لا توجد تكاملات معرّفة" : "No integrations configured"}
            </p>
          ) : (
            grouped.map(({ category, items }) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plug className="w-4 h-4" />
                    {CATEGORY_LABEL(category, ar)}
                    <Badge variant="secondary">{items.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((item) => (
                      <Card key={item.id} className={item.is_connected ? "border-primary/40" : "border-border"}>
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <p className="font-medium truncate">{item.display_name}</p>
                              <Badge
                                className={
                                  item.is_connected
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                    : "bg-muted text-muted-foreground"
                                }
                              >
                                {item.is_connected
                                  ? ar
                                    ? "مفعّل"
                                    : "Connected"
                                  : ar
                                    ? "غير مفعّل"
                                    : "Disconnected"}
                              </Badge>
                            </div>
                            <Switch
                              checked={!!item.is_connected}
                              onCheckedChange={(checked) =>
                                updateIntegration.mutate({ id: item.id, patch: { is_connected: checked } })
                              }
                            />
                          </div>

                          {item.config_hint && (
                            <p className="text-xs text-muted-foreground break-words" dir="ltr">
                              {item.config_hint}
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>
                              {ar ? "آخر مزامنة: " : "Last sync: "}
                              {formatDateTime(item.last_sync_at)}
                            </span>
                            {item.doc_url && (
                              <a
                                href={item.doc_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {ar ? "التوثيق" : "Docs"}
                              </a>
                            )}
                          </div>

                          {item.status_detail && (
                            <p className="text-xs text-muted-foreground truncate" title={item.status_detail}>
                              {item.status_detail}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Webhooks                                                         */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <WebhookIcon className="w-5 h-5" />
                  Webhooks
                </CardTitle>
                <Button size="sm" className="gap-1" onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4" />
                  {ar ? "إضافة Webhook" : "Add Webhook"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {webhooksLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : webhooks.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  {ar ? "لا توجد Webhooks بعد" : "No webhooks yet"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{ar ? "الاسم" : "Name"}</TableHead>
                        <TableHead>{ar ? "الحدث" : "Event"}</TableHead>
                        <TableHead>{ar ? "الوجهة" : "Target URL"}</TableHead>
                        <TableHead>{ar ? "نشط" : "Active"}</TableHead>
                        <TableHead>{ar ? "عدد الإرسالات" : "Triggers"}</TableHead>
                        <TableHead>{ar ? "آخر إرسال" : "Last Triggered"}</TableHead>
                        <TableHead className="text-end">{ar ? "إجراءات" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhooks.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="font-medium max-w-[14rem]">
                            <p className="truncate">{w.name}</p>
                            {w.secret_hint && (
                              <p className="text-xs text-muted-foreground truncate" dir="ltr">
                                {w.secret_hint}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={EVENT_STYLE[w.event_type]}>{EVENT_LABEL(w.event_type, ar)}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[18rem]">
                            <span className="text-sm text-muted-foreground" dir="ltr" title={w.target_url}>
                              {truncateUrl(w.target_url)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={!!w.is_active}
                              onCheckedChange={(checked) =>
                                updateWebhook.mutate({ id: w.id, patch: { is_active: checked } })
                              }
                            />
                          </TableCell>
                          <TableCell>{(w.trigger_count ?? 0).toLocaleString(locale)}</TableCell>
                          <TableCell className="text-sm">{formatDateTime(w.last_triggered_at)}</TableCell>
                          <TableCell className="text-end">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 gap-1"
                                disabled={testingId === w.id}
                                onClick={() => runTest(w.id)}
                              >
                                {testingId === w.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                {ar ? "اختبار" : "Test"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-destructive"
                                onClick={() => deleteWebhook.mutate(w.id)}
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

          {/* Delivery log ------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="w-4 h-4" />
                {ar ? "سجل محاولات الإرسال" : "Delivery Log"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deliveriesLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : deliveries.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  {ar ? "لا توجد محاولات إرسال مسجّلة" : "No delivery attempts recorded"}
                </p>
              ) : (
                <div className="space-y-2">
                  {deliveries.map((d) => {
                    const parent = d.webhook_id ? webhookById.get(d.webhook_id) : undefined;
                    return (
                      <div
                        key={d.id}
                        className="flex items-start gap-3 rounded-md border p-3 text-sm"
                      >
                        {d.success ? (
                          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium truncate">
                              {parent?.name ?? (ar ? "Webhook محذوف" : "Deleted webhook")}
                            </span>
                            {d.event_type && (
                              <Badge variant="secondary" className="text-xs">
                                {EVENT_LABEL(d.event_type as WebhookEventType, ar) ?? d.event_type}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {/* 0 means an opaque no-cors response — the status
                                  code is unreadable from the browser. */}
                              {d.response_status
                                ? `HTTP ${d.response_status}`
                                : ar
                                  ? "استجابة غير مقروءة"
                                  : "Opaque response"}
                            </span>
                          </div>
                          {d.error_detail && (
                            <p className="text-xs text-destructive break-words">{d.error_detail}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDateTime(d.delivered_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------------ */}
      {/* Create webhook dialog                                              */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setForm(EMPTY_FORM);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{ar ? "إضافة Webhook جديد" : "Add a Webhook"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{ar ? "الاسم" : "Name"}</Label>
              <Input
                value={form.name}
                placeholder={ar ? "مثال: إشعار فريق التوظيف" : "e.g. Notify recruiting team"}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{ar ? "رابط الوجهة" : "Target URL"}</Label>
              <Input
                dir="ltr"
                placeholder="https://example.com/hooks/recruitment"
                value={form.target_url}
                onChange={(e) => setForm((prev) => ({ ...prev, target_url: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{ar ? "نوع الحدث" : "Event Type"}</Label>
              <Select
                value={form.event_type}
                onValueChange={(v) => setForm((prev) => ({ ...prev, event_type: v as WebhookEventType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEBHOOK_EVENTS.map((event) => (
                    <SelectItem key={event} value={event}>
                      {EVENT_LABEL(event, ar)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{ar ? "اسم السرّ (اختياري)" : "Secret Hint (optional)"}</Label>
              <Input
                dir="ltr"
                placeholder="WEBHOOK_SECRET_ATS"
                value={form.secret_hint}
                onChange={(e) => setForm((prev) => ({ ...prev, secret_hint: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "اكتب اسم السرّ فقط وليس قيمته. القيمة الفعلية تُحفظ كسرّ في وظائف Edge وتُستخدم لتوقيع الطلبات."
                  : "Enter the secret's name only, never its value. The actual value is stored as an edge-function secret and used to sign requests."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={submitWebhook}
              disabled={!form.name.trim() || !form.target_url.trim() || createWebhook.isPending}
            >
              {createWebhook.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {ar ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
