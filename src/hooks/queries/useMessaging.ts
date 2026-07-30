import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useLanguage } from "@/contexts/LanguageContext";

export type MessagingProvider = "twilio" | "unifonic" | "msegat" | "whatsapp_cloud";
export type MessageChannel = "sms" | "whatsapp";
export type MessageStatus = "queued" | "sent" | "delivered" | "failed";

/**
 * Provider configuration. Deliberately contains NO secret: the auth token lives
 * only in the `SMS_AUTH_TOKEN` edge-function secret and is read server-side by
 * the `send-sms` function.
 */
export interface MessagingSettings {
  id: string;
  provider: MessagingProvider;
  account_sid: string | null;
  sender_id: string | null;
  is_active: boolean;
  notes: string | null;
  updated_at: string;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: MessageChannel;
  body_ar: string | null;
  body_en: string | null;
  variables: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MessageLogEntry {
  id: string;
  applicant_id: string | null;
  recipient_phone: string;
  channel: MessageChannel;
  body: string;
  status: MessageStatus;
  provider_message_id: string | null;
  error_detail: string | null;
  sent_by: string | null;
  created_at: string;
}

/** Minimal applicant shape used by the compose recipient picker. */
export interface MessagingRecipient {
  id: string;
  full_name: string | null;
  phone: string | null;
  desired_position: string | null;
}

export interface SendMessageInput {
  recipient_phone: string;
  channel: MessageChannel;
  body: string;
  applicant_id?: string | null;
}

export interface SendMessageResult {
  ok: boolean;
  logId: string | null;
  /** Raw provider/transport error, shown as toast description when present. */
  detail?: string;
}

/** Replaces `{{name}}` / `{{position}}` style placeholders; unknown keys are left intact. */
export function renderTemplate(body: string, vars: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined || value === null || value === "" ? match : value;
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Settings are a single logical row — we always read the most recent one. */
export function useMessagingSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.messaging.settings(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("messaging_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as MessagingSettings | null;
    },
  });
}

export function useUpsertMessagingSettingsMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (payload: Partial<MessagingSettings>) => {
      const patch = { ...payload, updated_at: new Date().toISOString() };
      delete (patch as Record<string, unknown>).created_at;

      if (payload.id) {
        const { error } = await (supabase as any)
          .from("messaging_settings")
          .update(patch)
          .eq("id", payload.id);
        if (error) throw error;
        return;
      }
      delete (patch as Record<string, unknown>).id;
      const { error } = await (supabase as any).from("messaging_settings").insert(patch);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all });
      toast.success(ar ? "تم حفظ إعدادات المزوّد" : "Provider settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function useMessageTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.messaging.templates(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("message_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MessageTemplate[];
    },
  });
}

export function useCreateMessageTemplateMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (payload: Partial<MessageTemplate> & { name: string }) => {
      const { error } = await (supabase as any).from("message_templates").insert({
        channel: "sms",
        is_active: true,
        variables: "{{name}},{{position}}",
        ...payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all });
      toast.success(ar ? "تم إنشاء القالب" : "Template created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteMessageTemplateMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("message_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all });
      toast.success(ar ? "تم حذف القالب" : "Template deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Log + sending
// ---------------------------------------------------------------------------

export function useMessageLogQuery() {
  return useQuery({
    queryKey: queryKeys.messaging.log(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("message_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as MessageLogEntry[];
    },
  });
}

/** Lightweight applicant list for the compose recipient picker (phone holders only). */
export function useMessagingRecipientsQuery() {
  return useQuery({
    queryKey: queryKeys.applicants.list({ scope: "messagingRecipients" }),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("applicants")
        .select("id, full_name, phone, desired_position")
        .not("phone", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as MessagingRecipient[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Queues a row in `message_log`, then asks the `send-sms` edge function to hand
 * it to the provider. The log row is the source of truth: if the function call
 * fails (most commonly because `SMS_AUTH_TOKEN` has not been set yet) the row is
 * flipped to `failed` with the reason attached, so nothing is silently lost.
 *
 * This mutation never rejects — the caller gets a `SendMessageResult` and the
 * user gets an explanatory toast either way.
 */
export function useSendMessageMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation<SendMessageResult, Error, SendMessageInput>({
    mutationFn: async ({ recipient_phone, channel, body, applicant_id }) => {
      let logId: string | null = null;
      try {
        const { data: userData } = await supabase.auth.getUser();

        const { data: inserted, error: insertError } = await (supabase as any)
          .from("message_log")
          .insert({
            applicant_id: applicant_id ?? null,
            recipient_phone,
            channel,
            body,
            status: "queued",
            sent_by: userData?.user?.id ?? null,
          })
          .select("id")
          .single();

        if (insertError) {
          return { ok: false, logId: null, detail: insertError.message };
        }
        logId = (inserted as { id: string }).id;

        const { data, error: fnError } = await supabase.functions.invoke("send-sms", {
          body: { log_id: logId, to: recipient_phone, channel, body, applicant_id: applicant_id ?? null },
        });

        // Edge functions can also report a soft failure inside a 200 payload.
        const payload = (data ?? {}) as { error?: string; message_id?: string; status?: MessageStatus };
        const failure = fnError?.message || payload.error;

        if (failure) {
          await (supabase as any)
            .from("message_log")
            .update({ status: "failed", error_detail: String(failure).slice(0, 500) })
            .eq("id", logId);
          return { ok: false, logId, detail: String(failure) };
        }

        await (supabase as any)
          .from("message_log")
          .update({
            status: payload.status ?? "sent",
            provider_message_id: payload.message_id ?? null,
            error_detail: null,
          })
          .eq("id", logId);

        return { ok: true, logId };
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        if (logId) {
          // Best effort — the log row must not stay stuck on "queued".
          await (supabase as any)
            .from("message_log")
            .update({ status: "failed", error_detail: detail.slice(0, 500) })
            .eq("id", logId)
            .then(undefined, () => undefined);
        }
        return { ok: false, logId, detail };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all });
      if (result.ok) {
        toast.success(ar ? "تم إرسال الرسالة" : "Message sent");
        return;
      }
      toast.error(
        ar
          ? "تعذّر الإرسال — مزوّد الرسائل غير مُهيّأ بعد. أضف السر SMS_AUTH_TOKEN في إعدادات دوال Supabase وفعّل دالة send-sms."
          : "Sending failed — the SMS provider is not configured yet. Add the SMS_AUTH_TOKEN secret in Supabase edge-function settings and deploy the send-sms function.",
        { description: result.detail }
      );
    },
    onError: (e: Error) => {
      // Safety net: mutationFn is written not to reject, but never leave the UI silent.
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all });
      toast.error(
        ar ? "تعذّر إرسال الرسالة" : "Could not send the message",
        { description: e.message }
      );
    },
  });
}
