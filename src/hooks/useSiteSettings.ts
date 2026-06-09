import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteSettings {
  id: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  site_name_ar: string;
  site_name_en: string;
}

const DEFAULT_SETTINGS: SiteSettings = {
  id: "",
  logo_url: null,
  primary_color: "#1a365d",
  accent_color: "#2f855a",
  site_name_ar: "مجموعة الخولي",
  site_name_en: "AlKholi Group",
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
