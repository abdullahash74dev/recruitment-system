import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";

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

interface PrefsData {
  prefs: DashboardPrefs;
  userId: string | null;
}

async function fetchDashboardPrefs(): Promise<PrefsData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const local = localStorage.getItem(STORAGE_KEY);
    let prefs = DEFAULT_PREFS;
    if (local) { try { prefs = mergeWithDefaults(JSON.parse(local)); } catch { /* ignore corrupt local prefs */ } }
    return { prefs, userId: null };
  }
  const { data } = await supabase.from("dashboard_preferences").select("prefs").eq("user_id", user.id).maybeSingle();
  return { prefs: mergeWithDefaults(data?.prefs as Partial<DashboardPrefs> | undefined), userId: user.id };
}

const PREFS_QUERY_KEY = queryKeys.dashboardPreferences.all;

export function useDashboardPrefs() {
  // Bound directly to the singleton queryClient (not context) so this shares
  // the cache with AdvancedAnalytics/AnalyticsHub/DashboardCustomizer even
  // outside a QueryClientProvider (e.g. in tests).
  const query = useQuery({ queryKey: PREFS_QUERY_KEY, queryFn: fetchDashboardPrefs }, queryClient);

  const prefs = query.data?.prefs ?? DEFAULT_PREFS;
  const userId = query.data?.userId ?? null;

  // setQueryData updates every mounted useDashboardPrefs() instance immediately
  // (no more CustomEvent bus needed — the shared query cache does that natively).
  const save = async (next: DashboardPrefs) => {
    queryClient.setQueryData<PrefsData>(PREFS_QUERY_KEY, (prev) => ({ prefs: next, userId: prev?.userId ?? null }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (!userId) return;
    await supabase.from("dashboard_preferences").upsert({ user_id: userId, prefs: next as any }, { onConflict: "user_id" });
  };

  const reset = () => save(DEFAULT_PREFS);

  return { prefs, save, reset, loading: query.isLoading };
}
