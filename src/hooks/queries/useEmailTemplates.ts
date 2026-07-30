import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useLanguage } from "@/contexts/LanguageContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmailTemplateCategory =
  | "general"
  | "interview"
  | "offer"
  | "rejection"
  | "onboarding"
  | "reminder";

export type CampaignStatus = "draft" | "scheduled" | "sending" | "completed" | "cancelled";

export interface EmailTemplate {
  id: string;
  name: string;
  subject_ar: string | null;
  subject_en: string | null;
  body_ar: string | null;
  body_en: string | null;
  category: EmailTemplateCategory;
  is_active: boolean | null;
  use_count: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailCampaign {
  id: string;
  name: string;
  template_id: string | null;
  /** Free-text audience expression, e.g. `status=new`. */
  target_filter: string | null;
  recipient_count: number | null;
  sent_count: number | null;
  failed_count: number | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export type EmailTemplateInput = Pick<
  EmailTemplate,
  "name" | "subject_ar" | "subject_en" | "body_ar" | "body_en" | "category" | "is_active"
>;

export type EmailCampaignInput = Pick<
  EmailCampaign,
  "name" | "template_id" | "target_filter" | "recipient_count" | "status" | "scheduled_at"
>;

/** Category order used by the filter chips and the category select. */
export const TEMPLATE_CATEGORIES: EmailTemplateCategory[] = [
  "general",
  "interview",
  "offer",
  "rejection",
  "onboarding",
  "reminder",
];

export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "draft",
  "scheduled",
  "sending",
  "completed",
  "cancelled",
];

/**
 * Placeholders substituted at send time. Kept here (not in the component) so
 * the editor legend and the preview renderer can never drift apart.
 */
export const TEMPLATE_PLACEHOLDERS = ["{{name}}", "{{position}}", "{{date}}", "{{company}}"] as const;

/** Sample values used only by the preview dialog. */
export const PREVIEW_SAMPLE: Record<string, { ar: string; en: string }> = {
  "{{name}}": { ar: "أحمد العتيبي", en: "Ahmed Al-Otaibi" },
  "{{position}}": { ar: "محاسب أول", en: "Senior Accountant" },
  "{{date}}": { ar: "١٠ أغسطس ٢٠٢٦، ١٠:٠٠ ص", en: "10 August 2026, 10:00 AM" },
  "{{company}}": { ar: "منصة التوظيف الذكية", en: "NexHire AI" },
};

/**
 * Replaces every known placeholder with its sample value. Unknown `{{...}}`
 * tokens are deliberately left untouched so a typo is visible in the preview
 * rather than silently blanked.
 */
export function renderPreview(body: string | null | undefined, ar: boolean): string {
  let out = body ?? "";
  for (const token of TEMPLATE_PLACEHOLDERS) {
    const sample = PREVIEW_SAMPLE[token];
    if (!sample) continue;
    out = out.split(token).join(ar ? sample.ar : sample.en);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function useEmailTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.emailTemplates.list(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EmailTemplate[];
    },
  });
}

export function useCreateEmailTemplateMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (payload: Partial<EmailTemplateInput>) => {
      const name = (payload.name ?? "").trim();
      if (!name) throw new Error(ar ? "اسم القالب مطلوب" : "Template name is required");

      const { data: userData } = await supabase.auth.getUser();

      const { error } = await (supabase as any).from("email_templates").insert({
        name,
        category: payload.category ?? "general",
        subject_ar: payload.subject_ar?.trim() || null,
        subject_en: payload.subject_en?.trim() || null,
        body_ar: payload.body_ar ?? null,
        body_en: payload.body_en ?? null,
        is_active: payload.is_active ?? true,
        use_count: 0,
        created_by: userData?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
      toast.success(ar ? "تم إنشاء القالب" : "Template created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateEmailTemplateMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EmailTemplate> }) => {
      const body: Record<string, unknown> = { ...patch };
      // Server-owned columns are never client-writable.
      delete body.id;
      delete body.created_at;
      delete body.created_by;
      // Touch updated_at on every edit — no DB trigger exists for it.
      body.updated_at = new Date().toISOString();

      if (typeof body.name === "string") {
        const name = body.name.trim();
        if (!name) throw new Error(ar ? "اسم القالب مطلوب" : "Template name is required");
        body.name = name;
      }

      const { error } = await (supabase as any).from("email_templates").update(body).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
      toast.success(ar ? "تم تحديث القالب" : "Template updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteEmailTemplateMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Campaigns hold an ON DELETE SET NULL reference, so their rows change
      // too — invalidate the whole module, not just the template list.
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
      toast.success(ar ? "تم حذف القالب" : "Template deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export function useEmailCampaignsQuery() {
  return useQuery({
    queryKey: queryKeys.emailTemplates.campaigns(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("email_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EmailCampaign[];
    },
  });
}

export function useCreateCampaignMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (payload: Partial<EmailCampaignInput>) => {
      const name = (payload.name ?? "").trim();
      if (!name) throw new Error(ar ? "اسم الحملة مطلوب" : "Campaign name is required");

      const scheduledAt = payload.scheduled_at || null;
      const status: CampaignStatus = payload.status ?? (scheduledAt ? "scheduled" : "draft");
      if (status === "scheduled" && !scheduledAt) {
        throw new Error(ar ? "حدد موعد الإرسال للحملة المجدولة" : "A scheduled campaign needs a send date");
      }

      const { data: userData } = await supabase.auth.getUser();

      const { error } = await (supabase as any).from("email_campaigns").insert({
        name,
        template_id: payload.template_id || null,
        target_filter: payload.target_filter?.trim() || null,
        recipient_count: payload.recipient_count ?? 0,
        sent_count: 0,
        failed_count: 0,
        status,
        scheduled_at: scheduledAt,
        created_by: userData?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
      toast.success(ar ? "تم إنشاء الحملة" : "Campaign created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCampaignMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EmailCampaign> }) => {
      const body: Record<string, unknown> = { ...patch };
      delete body.id;
      delete body.created_at;
      delete body.created_by;

      const { error } = await (supabase as any).from("email_campaigns").update(body).eq("id", id);
      if (error) throw error;

      // Completing a campaign is what "uses" a template. Done here rather than
      // in a DB trigger so the counter stays in step with the same optimistic
      // status transitions the UI drives, and only ever counts a completion
      // once (the caller guards against re-completing an already-done row).
      if (patch.status === "completed" && patch.template_id !== null) {
        const templateId = patch.template_id ?? null;
        if (templateId) {
          const { data: tpl } = await (supabase as any)
            .from("email_templates")
            .select("use_count")
            .eq("id", templateId)
            .maybeSingle();
          if (tpl) {
            await (supabase as any)
              .from("email_templates")
              .update({ use_count: (tpl.use_count ?? 0) + 1, updated_at: new Date().toISOString() })
              .eq("id", templateId);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
      toast.success(ar ? "تم تحديث الحملة" : "Campaign updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCampaignMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("email_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
      toast.success(ar ? "تم حذف الحملة" : "Campaign deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
