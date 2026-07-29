import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  tasks?: OnboardingTaskTemplate[];
}

export interface OnboardingTaskTemplate {
  id: string;
  template_id: string;
  task_name: string;
  task_description: string | null;
  due_days_after_start: number;
  assigned_to_role: string | null;
  order_index: number;
}

export interface OnboardingChecklistItem {
  id: string;
  checklist_id: string;
  task_name: string;
  task_description: string | null;
  due_date: string | null;
  assigned_to: string | null;
  status: "pending" | "in_progress" | "done" | "skipped";
  completed_at: string | null;
  notes: string | null;
  order_index: number;
}

export interface OnboardingChecklist {
  id: string;
  applicant_id: string | null;
  template_id: string | null;
  employee_name: string | null;
  start_date: string | null;
  status: "not_started" | "in_progress" | "completed";
  created_at: string;
  items?: OnboardingChecklistItem[];
}

export function useOnboardingTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.onboarding.templates(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("onboarding_templates")
        .select("*, onboarding_tasks_template(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((t) => ({
        ...t,
        tasks: (t.onboarding_tasks_template ?? []).sort(
          (a: OnboardingTaskTemplate, b: OnboardingTaskTemplate) => a.order_index - b.order_index
        ),
      })) as OnboardingTemplate[];
    },
  });
}

export function useOnboardingChecklistsQuery() {
  return useQuery({
    queryKey: queryKeys.onboarding.checklists(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("onboarding_checklists")
        .select("*, onboarding_checklist_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((c) => ({
        ...c,
        items: (c.onboarding_checklist_items ?? []).sort(
          (a: OnboardingChecklistItem, b: OnboardingChecklistItem) => a.order_index - b.order_index
        ),
      })) as OnboardingChecklist[];
    },
  });
}

export function useCreateTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      description,
      tasks,
    }: {
      name: string;
      description?: string;
      tasks: { task_name: string; task_description?: string; due_days_after_start: number }[];
    }) => {
      const { data, error } = await (supabase as any)
        .from("onboarding_templates")
        .insert({ name, description: description ?? null })
        .select("id")
        .single();
      if (error) throw error;
      if (tasks.length > 0) {
        const { error: taskError } = await (supabase as any).from("onboarding_tasks_template").insert(
          tasks.map((t, i) => ({
            template_id: data.id,
            task_name: t.task_name,
            task_description: t.task_description ?? null,
            due_days_after_start: t.due_days_after_start,
            order_index: i,
          }))
        );
        if (taskError) throw taskError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all });
      toast.success("تم إنشاء القالب");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("onboarding_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all });
      toast.success("تم حذف القالب");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Instantiates a checklist from a template, materialising each template task
 *  as a dated checklist item relative to the employee's start date. */
export function useCreateChecklistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employee_name,
      start_date,
      template,
      applicant_id,
    }: {
      employee_name: string;
      start_date: string;
      template: OnboardingTemplate;
      applicant_id?: string | null;
    }) => {
      const { data, error } = await (supabase as any)
        .from("onboarding_checklists")
        .insert({
          employee_name,
          start_date,
          template_id: template.id,
          applicant_id: applicant_id ?? null,
          status: "in_progress",
        })
        .select("id")
        .single();
      if (error) throw error;

      const tasks = template.tasks ?? [];
      if (tasks.length > 0) {
        const start = new Date(start_date).getTime();
        const { error: itemError } = await (supabase as any).from("onboarding_checklist_items").insert(
          tasks.map((t, i) => ({
            checklist_id: data.id,
            task_name: t.task_name,
            task_description: t.task_description,
            due_date: new Date(start + t.due_days_after_start * 86400000).toISOString().slice(0, 10),
            assigned_to: t.assigned_to_role,
            order_index: i,
          }))
        );
        if (itemError) throw itemError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all });
      toast.success("تم إنشاء قائمة التأهيل");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateChecklistItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OnboardingChecklistItem["status"] }) => {
      const { error } = await (supabase as any)
        .from("onboarding_checklist_items")
        .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteChecklistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("onboarding_checklists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all });
      toast.success("تم الحذف");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
