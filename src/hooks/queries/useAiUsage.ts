import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface UsageSetting {
  id: string;
  service: string;
  display_name_ar: string;
  display_name_en: string | null;
  monthly_cap_usd: number;
  warn_threshold_pct: number;
  hard_stop: boolean;
}

export interface ServiceStat {
  service: string;
  totalCost: number;
  totalCalls: number;
  totalTokens: number;
  errors: number;
  lastUsed: string | null;
}

export interface AiUsageLogData {
  settings: UsageSetting[];
  stats: Record<string, ServiceStat>;
}

function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function fetchAiUsageLog(): Promise<AiUsageLogData> {
  const [{ data: s }, { data: logs }] = await Promise.all([
    supabase.from("ai_usage_settings").select("*").order("service"),
    supabase
      .from("ai_usage_log")
      .select("service,estimated_cost_usd,total_tokens,status,created_at")
      .gte("created_at", monthStart()),
  ]);
  const settings = (s as any) || [];
  const map: Record<string, ServiceStat> = {};
  for (const l of (logs as any[]) || []) {
    const k = l.service;
    if (!map[k]) map[k] = { service: k, totalCost: 0, totalCalls: 0, totalTokens: 0, errors: 0, lastUsed: null };
    map[k].totalCost += Number(l.estimated_cost_usd || 0);
    map[k].totalTokens += Number(l.total_tokens || 0);
    map[k].totalCalls += 1;
    if (l.status !== "success") map[k].errors += 1;
    if (!map[k].lastUsed || l.created_at > map[k].lastUsed) map[k].lastUsed = l.created_at;
  }
  return { settings, stats: map };
}

export function useAiUsageLogQuery() {
  return useQuery({
    queryKey: queryKeys.aiUsage.log(),
    queryFn: fetchAiUsageLog,
  });
}

export type UsageSettingPatch = { row: UsageSetting; patch: Partial<UsageSetting> };

export function useUpdateAiUsageSettingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ row, patch }: UsageSettingPatch) => {
      const { error } = await supabase.from("ai_usage_settings").update(patch).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiUsage.log() });
    },
  });
}

export interface ProviderStatus {
  gemini_configured: boolean;
  anthropic_configured: boolean;
}

export interface AiProviderSettingsData {
  settingsId: string | null;
  provider: "gemini" | "claude";
  status: ProviderStatus | null;
}

async function fetchAiProviderSettings(): Promise<AiProviderSettingsData> {
  const [settingsRes, statusRes] = await Promise.all([
    supabase.from("ai_settings").select("id, provider").limit(1).maybeSingle(),
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("ai-provider-status");
        if (error) throw error;
        return data as ProviderStatus;
      } catch {
        return null;
      }
    })(),
  ]);

  const data = settingsRes.data;
  return {
    settingsId: data?.id ?? null,
    provider: ((data?.provider as "gemini" | "claude") || "gemini"),
    status: statusRes,
  };
}

export function useAiProviderSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.aiUsage.settings(),
    queryFn: fetchAiProviderSettings,
  });
}

export function useUpdateAiProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ settingsId, provider }: { settingsId: string | null; provider: "gemini" | "claude" }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { provider, updated_by: user?.id || null, updated_at: new Date().toISOString() };
      const { error } = settingsId
        ? await supabase.from("ai_settings").update(payload).eq("id", settingsId)
        : await supabase.from("ai_settings").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiUsage.settings() });
    },
  });
}
