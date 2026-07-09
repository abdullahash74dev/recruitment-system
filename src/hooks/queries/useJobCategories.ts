import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export type Category = { id: string; name_ar: string; name_en: string | null; color: string | null; sort_order: number };
export type TitleRow = { title_normalized: string; title_display: string; count: number; category_id: string | null };

export const normTitle = (s: string) =>
  String(s || "").trim().toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/\s+/g, " ").trim();

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("job_categories").select("*").order("sort_order");
  if (error) throw error;
  return (data || []) as Category[];
}

// Applicants is paginated: a flat .limit() would only scan a fraction of
// desired_position values once the table exceeds the page size, leaving
// most job titles undiscovered for categorization.
async function fetchAllDesiredPositions(): Promise<{ desired_position: string | null }[]> {
  const PAGE_SIZE = 1000;
  const rows: { desired_position: string | null }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from("applicants").select("desired_position").range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchTitleRows(): Promise<TitleRow[]> {
  const [mapRes, appsRows, recRes] = await Promise.all([
    supabase.from("job_title_categories").select("*"),
    fetchAllDesiredPositions(),
    supabase.from("recruitment_job_titles").select("title_ar"),
  ]);
  if (mapRes.error) throw mapRes.error;
  if (recRes.error) throw recRes.error;

  const mapByNorm = new Map<string, string | null>();
  (mapRes.data || []).forEach((m: any) => mapByNorm.set(m.title_normalized, m.category_id));

  // Aggregate titles from applicants + recruitment_job_titles
  const agg = new Map<string, { display: string; count: number }>();
  const consume = (raw: string | null | undefined) => {
    if (!raw) return;
    const t = String(raw).trim();
    if (!t) return;
    const n = normTitle(t);
    if (!n) return;
    const cur = agg.get(n);
    if (cur) cur.count++;
    else agg.set(n, { display: t, count: 1 });
  };
  appsRows.forEach((r) => consume(r.desired_position));
  (recRes.data || []).forEach((r: any) => consume(r.title_ar));

  const rows: TitleRow[] = Array.from(agg.entries()).map(([n, v]) => ({
    title_normalized: n,
    title_display: v.display,
    count: v.count,
    category_id: mapByNorm.get(n) ?? null,
  }));
  rows.sort((a, b) => a.title_display.localeCompare(b.title_display, "ar"));
  return rows;
}

export function useJobCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.jobCategories.list(),
    queryFn: fetchCategories,
  });
}

export function useJobTitleCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.jobCategories.titleCategories(),
    queryFn: fetchTitleRows,
  });
}

export type TitleCategoryUpsert = { title_normalized: string; title_display: string; category_id: string | null };

export function useSaveTitleCategoriesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (upserts: TitleCategoryUpsert[]) => {
      const { error } = await supabase.from("job_title_categories").upsert(upserts, { onConflict: "title_normalized" });
      if (error) throw error;
      return upserts;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobCategories.all });
    },
  });
}

export type NewCategoryInput = { name_ar: string; name_en: string | null; sort_order: number };

export function useAddCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewCategoryInput) => {
      const { error } = await supabase.from("job_categories").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobCategories.all });
    },
  });
}

export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("job_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobCategories.all });
    },
  });
}

export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Category> }) => {
      const { error } = await supabase.from("job_categories").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobCategories.all });
    },
  });
}
