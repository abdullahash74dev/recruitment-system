import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";

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

let cachedSettings: SiteSettings | null = null;

export const fetchSiteSettings = async (): Promise<SiteSettings> => {
  if (cachedSettings) return cachedSettings;
  const { data } = await supabase
    .from("site_settings")
    .select("*")
    .limit(1)
    .single();
  if (data) {
    cachedSettings = data as SiteSettings;
    return cachedSettings;
  }
  return DEFAULT_SETTINGS;
};

export const invalidateSiteSettingsCache = () => { cachedSettings = null; };

export const useSiteSettings = () => {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    invalidateSiteSettingsCache();
    const s = await fetchSiteSettings();
    setSettings(s);
  };

  useEffect(() => {
    fetchSiteSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  return { settings, loading, refresh };
};
