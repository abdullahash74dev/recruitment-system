import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";

export interface SiteSettings {
  id: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  site_name_ar: string;
  site_name_en: string;
  two_factor_enabled: boolean;
  public_theme_palette: string;
}

const DEFAULT_SETTINGS: SiteSettings = {
  id: "",
  logo_url: null,
  primary_color: "#3b82f6",
  accent_color: "#22d3ee",
  site_name_ar: "منصة التوظيف الذكية",
  site_name_en: "NexHire AI",
  // Fail open if settings can't be loaded, so a fetch error never locks
  // admins out behind a 2FA prompt they can't complete.
  two_factor_enabled: false,
  public_theme_palette: "custom",
};

async function fetchSiteSettingsRaw(): Promise<SiteSettings> {
  const { data } = await supabase
    .from("site_settings")
    .select("*")
    .limit(1)
    .single();
  return data ? (data as SiteSettings) : DEFAULT_SETTINGS;
}

export const fetchSiteSettings = (): Promise<SiteSettings> =>
  queryClient.fetchQuery({ queryKey: queryKeys.siteSettings.all, queryFn: fetchSiteSettingsRaw });

export const invalidateSiteSettingsCache = () =>
  queryClient.invalidateQueries({ queryKey: queryKeys.siteSettings.all });

export const useSiteSettings = () => {
  // Bound directly to the singleton queryClient (not context) so this stays in
  // sync with fetchSiteSettings/invalidateSiteSettingsCache even when rendered
  // outside a QueryClientProvider (e.g. in tests).
  const query = useQuery({ queryKey: queryKeys.siteSettings.all, queryFn: fetchSiteSettingsRaw }, queryClient);

  const refresh = async () => {
    await invalidateSiteSettingsCache();
    await query.refetch();
  };

  return { settings: query.data ?? DEFAULT_SETTINGS, loading: query.isLoading, refresh };
};
