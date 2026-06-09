import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ChartType = "pie" | "donut" | "bar" | "barH" | "line" | "area";
export type DashboardTheme = "executive" | "aurora" | "emerald" | "graphite" | "royal" | "cyberpunk" | "neon" | "holographic" | "matrix";
export type DashboardDensity = "comfortable" | "compact";
export type DashboardScale = "sm" | "md" | "lg" | "xl";

export interface SectionPref {
  id: string;
  visible: boolean;
  chart?: ChartType;
}

export interface DashboardPrefs {
  sections: SectionPref[];
  theme: DashboardTheme;
  density: DashboardDensity;
  scale?: DashboardScale;
  customTitle?: string;
  customSubtitle?: string;
  customEyebrow?: string;
}

export const DEFAULT_PREFS: DashboardPrefs = {
  sections: [
    { id: "saudization", visible: true, chart: "donut" },
    { id: "nationality", visible: true, chart: "barH" },
    { id: "currentCity", visible: true, chart: "barH" },
    { id: "preferredCity", visible: true, chart: "bar" },
    { id: "salary", visible: true, chart: "barH" },
    { id: "education", visible: true, chart: "donut" },
    { id: "trend", visible: true, chart: "area" },
    { id: "gender", visible: true, chart: "donut" },
    { id: "majors", visible: true, chart: "barH" },
    { id: "experience", visible: true, chart: "bar" },
    { id: "jobType", visible: true, chart: "donut" },
  ],
  theme: "executive",
  density: "comfortable",
  scale: "md",
  customTitle: "",
  customSubtitle: "",
  customEyebrow: "",
};

export const DEFAULT_SECTIONS: SectionPref[] = DEFAULT_PREFS.sections;

export const SECTION_LABELS: Record<string, { ar: string; en: string }> = {
  saudization: { ar: "نسبة السعودة", en: "Saudization" },
  nationality: { ar: "توزيع الجنسيات", en: "Nationality" },
  currentCity: { ar: "مدينة السكن", en: "Current City" },
  preferredCity: { ar: "المدينة المفضلة", en: "Preferred City" },
  salary: { ar: "متوسط الرواتب", en: "Avg Salary" },
  education: { ar: "المستوى التعليمي", en: "Education" },
  trend: { ar: "حركة التقديم", en: "Application Trend" },
  gender: { ar: "الجنس", en: "Gender" },
  majors: { ar: "التخصصات", en: "Majors" },
  experience: { ar: "سنوات الخبرة", en: "Experience" },
  jobType: { ar: "نوع العمل", en: "Job Type" },
};

const STORAGE_KEY = "dashboard_prefs_v1";

const mergeSectionsWithDefaults = (saved: SectionPref[] | undefined): SectionPref[] => {
  const list: SectionPref[] = [];
  const seen = new Set<string>();
  (saved || []).forEach(s => {
    const def = DEFAULT_SECTIONS.find(d => d.id === s.id);
    if (def) { list.push({ ...def, ...s }); seen.add(s.id); }
  });
  DEFAULT_SECTIONS.forEach(d => { if (!seen.has(d.id)) list.push(d); });
  return list;
};

const mergeWithDefaults = (saved: Partial<DashboardPrefs> | undefined): DashboardPrefs => ({
  ...DEFAULT_PREFS,
  ...(saved || {}),
  sections: mergeSectionsWithDefaults(saved?.sections),
});

export function useDashboardPrefs() {
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) try { setPrefs(mergeWithDefaults(JSON.parse(local))); } catch {}
        setLoading(false);
        return;
      }
      setUserId(user.id);
      const { data } = await supabase.from("dashboard_preferences").select("prefs").eq("user_id", user.id).maybeSingle();
      setPrefs(mergeWithDefaults(data?.prefs as Partial<DashboardPrefs> | undefined));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const sync = (e: Event) => setPrefs((e as CustomEvent<DashboardPrefs>).detail);
    window.addEventListener("dashboard-prefs-updated", sync as EventListener);
    return () => window.removeEventListener("dashboard-prefs-updated", sync as EventListener);
  }, []);

  const save = useCallback(async (next: DashboardPrefs) => {
    setPrefs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("dashboard-prefs-updated", { detail: next }));
    if (!userId) return;
    await supabase.from("dashboard_preferences").upsert({ user_id: userId, prefs: next as any }, { onConflict: "user_id" });
  }, [userId]);

  const reset = useCallback(() => save(DEFAULT_PREFS), [save]);

  return { prefs, save, reset, loading };
}
