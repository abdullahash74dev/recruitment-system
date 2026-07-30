import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useLanguage } from "@/contexts/LanguageContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntegrationCategory =
  | "hris"
  | "payroll"
  | "calendar"
  | "background_check"
  | "esignature"
  | "communication"
  | "analytics"
  | "other";

export type WebhookEventType =
  | "applicant_created"
  | "status_changed"
  | "interview_scheduled"
  | "offer_sent"
  | "candidate_hired";

export interface Integration {
  id: string;
  /** Stable machine key (snake_case) — seeded, never edited from the UI. */
  service: string;
  display_name: string;
  category: IntegrationCategory;
  /** Admin-declared intent, not a verified handshake. */
  is_connected: boolean | null;
  /** Names the edge-function secret(s) an admin must provision. Never a value. */
  config_hint: string | null;
  doc_url: string | null;
  last_sync_at: string | null;
  status_detail: string | null;
  created_at: string;
}

export interface Webhook {
  id: string;
  name: string;
  target_url: string;
  event_type: WebhookEventType;
  is_active: boolean | null;
  /** Label for the signing secret (e.g. `WEBHOOK_SECRET_ATS`), not the secret. */
  secret_hint: string | null;
  last_triggered_at: string | null;
  trigger_count: number | null;
  created_by: string | null;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string | null;
  event_type: string | null;
  /** 0 for browser test pings — `no-cors` responses are opaque. */
  response_status: number | null;
  success: boolean | null;
  error_detail: string | null;
  delivered_at: string;
}

export interface CreateWebhookInput {
  name: string;
  target_url: string;
  event_type: WebhookEventType;
  secret_hint?: string | null;
  is_active?: boolean;
}

export interface UpdateWebhookInput {
  id: string;
  patch: Partial<Omit<Webhook, "id" | "created_at">>;
}

/** Category display order for the integrations tab. */
export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  "hris",
  "payroll",
  "calendar",
  "background_check",
  "esignature",
  "communication",
  "analytics",
  "other",
];

export const CATEGORY_LABEL = (c: IntegrationCategory, ar: boolean) =>
  ar
    ? {
        hris: "أنظمة الموارد البشرية",
        payroll: "الرواتب",
        calendar: "التقويم",
        background_check: "التحقق من الخلفية",
        esignature: "التوقيع الإلكتروني",
        communication: "التواصل",
        analytics: "التحليلات",
        other: "أخرى",
      }[c]
    : {
        hris: "HRIS",
        payroll: "Payroll",
        calendar: "Calendar",
        background_check: "Background Checks",
        esignature: "E-Signature",
        communication: "Communication",
        analytics: "Analytics",
        other: "Other",
      }[c];

export const WEBHOOK_EVENTS: WebhookEventType[] = [
  "applicant_created",
  "status_changed",
  "interview_scheduled",
  "offer_sent",
  "candidate_hired",
];

export const EVENT_LABEL = (e: WebhookEventType, ar: boolean) =>
  ar
    ? {
        applicant_created: "متقدم جديد",
        status_changed: "تغيّر الحالة",
        interview_scheduled: "جدولة مقابلة",
        offer_sent: "إرسال عرض",
        candidate_hired: "تم التوظيف",
      }[e]
    : {
        applicant_created: "Applicant Created",
        status_changed: "Status Changed",
        interview_scheduled: "Interview Scheduled",
        offer_sent: "Offer Sent",
        candidate_hired: "Candidate Hired",
      }[e];

/** Recent-attempts window shown in the delivery log. */
const DELIVERIES_LIMIT = 50;

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

/**
 * Rows are seeded by the migration, so this list is effectively a fixed
 * catalogue. Ordered by category then name to match the grouped rendering and
 * keep the grid from reshuffling after a toggle.
 */
export function useIntegrationsQuery() {
  return useQuery({
    queryKey: queryKeys.integrations.list(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("integrations")
        .select("*")
        .order("category", { ascending: true })
        .order("display_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Integration[];
    },
  });
}

/**
 * Update keyed by `id` — the UI only ever flips `is_connected` (and, in future,
 * writes sync metadata). `service`/`created_at` are stripped so an accidental
 * spread of a full row can't rewrite the stable identity of a seeded service.
 */
export function useUpdateIntegrationMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Integration> }) => {
      const body: Record<string, unknown> = { ...patch };
      delete body.id;
      delete body.service;
      delete body.created_at;

      const { error } = await (supabase as any).from("integrations").update(body).eq("id", id);
      if (error) throw error;
      return patch.is_connected ?? null;
    },
    onSuccess: (connected) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      if (connected === null) {
        toast.success(ar ? "تم تحديث التكامل" : "Integration updated");
        return;
      }
      toast.success(
        connected
          ? ar
            ? "تم تفعيل التكامل — تأكد من إضافة المفاتيح كأسرار"
            : "Integration enabled — remember to add its secrets"
          : ar
            ? "تم إيقاف التكامل"
            : "Integration disabled"
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export function useWebhooksQuery() {
  return useQuery({
    queryKey: queryKeys.integrations.webhooks(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("webhooks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Webhook[];
    },
  });
}

export function useCreateWebhookMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (input: CreateWebhookInput) => {
      const name = input.name.trim();
      const url = input.target_url.trim();
      if (!name) throw new Error(ar ? "اسم الـ Webhook مطلوب" : "Webhook name is required");
      if (!url) throw new Error(ar ? "رابط الوجهة مطلوب" : "Target URL is required");
      // Validated here rather than only at the DB: a bad URL fails silently at
      // send time (opaque no-cors response), so reject it at creation instead.
      if (!/^https?:\/\/.+/i.test(url)) {
        throw new Error(ar ? "يجب أن يبدأ الرابط بـ http:// أو https://" : "URL must start with http:// or https://");
      }

      const { data: userData } = await supabase.auth.getUser();

      const { error } = await (supabase as any).from("webhooks").insert({
        name,
        target_url: url,
        event_type: input.event_type,
        secret_hint: (input.secret_hint ?? "").trim() || null,
        is_active: input.is_active ?? true,
        trigger_count: 0,
        created_by: userData?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      toast.success(ar ? "تم إنشاء الـ Webhook" : "Webhook created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateWebhookMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async ({ id, patch }: UpdateWebhookInput) => {
      const body: Record<string, unknown> = { ...patch };
      delete body.id;
      delete body.created_at;

      const { error } = await (supabase as any).from("webhooks").update(body).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      toast.success(ar ? "تم تحديث الـ Webhook" : "Webhook updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteWebhookMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("webhooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Deliveries cascade-delete with the webhook, so refresh the whole module.
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      toast.success(ar ? "تم حذف الـ Webhook" : "Webhook deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

export function useWebhookDeliveriesQuery() {
  return useQuery({
    queryKey: queryKeys.integrations.deliveries(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("webhook_deliveries")
        .select("*")
        .order("delivered_at", { ascending: false })
        .limit(DELIVERIES_LIMIT);
      if (error) throw error;
      return (data ?? []) as WebhookDelivery[];
    },
  });
}

/**
 * Fires a one-off test ping at a webhook's target URL from the browser.
 *
 * `mode: "no-cors"` is deliberate: arbitrary customer endpoints won't send CORS
 * headers back, so a normal request would be blocked before it ever left. The
 * trade-off is an *opaque* response — we cannot read the status code, which is
 * why `response_status` is recorded as 0 and success means "the request left
 * the browser without a network error", not "the endpoint returned 2xx". A real
 * signed delivery with a readable status needs an edge function holding the
 * signing secret; this is a reachability smoke test.
 *
 * Contract: never rejects. Any failure is captured into the delivery log with
 * `success = false`, so `onError` is effectively unreachable and the UI always
 * lands in `onSuccess` with a verdict to display.
 */
export function useTestWebhookMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (webhook: Webhook) => {
      let success = false;
      let errorDetail: string | null = null;

      try {
        await fetch(webhook.target_url, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: webhook.event_type,
            test: true,
            webhook_id: webhook.id,
            webhook_name: webhook.name,
            sent_at: new Date().toISOString(),
            data: {
              message: "Test delivery from the recruitment system integrations hub",
            },
          }),
        });
        success = true;
      } catch (e) {
        errorDetail = e instanceof Error ? e.message : String(e);
      }

      // Logging is best-effort and must not turn a successful ping into a thrown
      // error — the ping already happened, and a failed insert is a reporting
      // problem, not a delivery problem.
      const { error: logError } = await (supabase as any).from("webhook_deliveries").insert({
        webhook_id: webhook.id,
        event_type: webhook.event_type,
        response_status: 0,
        success,
        error_detail: errorDetail,
      });
      if (logError && !errorDetail) errorDetail = logError.message;

      // Read-then-write rather than an atomic increment: there is no RPC for it
      // and test pings are manual, single-user actions, so the lost-update
      // window is not a practical concern for this counter.
      const { data: current } = await (supabase as any)
        .from("webhooks")
        .select("trigger_count")
        .eq("id", webhook.id)
        .maybeSingle();

      await (supabase as any)
        .from("webhooks")
        .update({
          trigger_count: (current?.trigger_count ?? webhook.trigger_count ?? 0) + 1,
          last_triggered_at: new Date().toISOString(),
        })
        .eq("id", webhook.id);

      return { success, errorDetail };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
      if (result.success) {
        toast.success(
          ar
            ? "تم إرسال طلب الاختبار — تحقق من سجل الوجهة لتأكيد الاستلام"
            : "Test request sent — check the destination log to confirm receipt"
        );
      } else {
        toast.error(
          ar
            ? `تعذّر إرسال طلب الاختبار: ${result.errorDetail ?? "خطأ في الشبكة"}`
            : `Test request failed: ${result.errorDetail ?? "network error"}`
        );
      }
    },
    // Only reachable if Supabase itself throws outside the guarded paths above.
    onError: (e: Error) => toast.error(e.message),
  });
}
