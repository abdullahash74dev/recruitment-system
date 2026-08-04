// React Query hooks for the HR Forms module: employee master data, form
// templates, and form submissions. Same shape as the other hooks in this
// folder (thin wrappers over supabase + queryKeys invalidation + sonner).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import type {
  Employee,
  HrFormSubmission,
  HrFormTemplate,
  HrSubmissionStatus,
  HrTemplateSchema,
} from "@/lib/hrForms/types";

// The hr_forms tables are newer than the generated Database typings, so the
// table calls go through an untyped alias — same approach as other recent
// modules (offer letters, onboarding) until typings are regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export interface EmployeeInput {
  employee_no?: string | null;
  full_name_en: string;
  full_name_ar?: string | null;
  national_id?: string | null;
  passport_no?: string | null;
  nationality?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  marital_status?: string | null;
  phone?: string | null;
  personal_email?: string | null;
  work_email?: string | null;
  department?: string | null;
  job_title?: string | null;
  manager_employee_id?: string | null;
  employment_type?: string | null;
  hire_date?: string | null;
  end_of_service_date?: string | null;
  base_salary?: number | null;
  housing_allowance?: number | null;
  transport_allowance?: number | null;
  salary_currency?: string;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_iban?: string | null;
  status?: string;
  photo_url?: string | null;
  extra?: Record<string, unknown>;
}

export function useEmployeesQuery() {
  return useQuery({
    queryKey: queryKeys.employees.list(),
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await db
        .from("employees")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateEmployeeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EmployeeInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await db
        .from("employees")
        .insert({ ...input, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as Employee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
      toast.success("Employee created");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateEmployeeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EmployeeInput> }) => {
      const { error } = await db.from("employees").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
      toast.success("Employee updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteEmployeeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
      toast.success("Employee moved to trash");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// ---------------------------------------------------------------------------
// Form templates
// ---------------------------------------------------------------------------

export function useHrFormTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.hrFormTemplates.list(),
    queryFn: async (): Promise<HrFormTemplate[]> => {
      const { data, error } = await db
        .from("hr_form_templates")
        .select("*")
        .order("slug", { ascending: true })
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HrFormTemplate[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

/** Latest version per slug — what the catalog and fill screens list. */
export function latestTemplates(templates: HrFormTemplate[]): HrFormTemplate[] {
  const bySlug = new Map<string, HrFormTemplate>();
  for (const t of templates) {
    const existing = bySlug.get(t.slug);
    if (!existing || t.version > existing.version) bySlug.set(t.slug, t);
  }
  return [...bySlug.values()].sort((a, b) => (a.doc_no ?? "").localeCompare(b.doc_no ?? ""));
}

export interface TemplateInput {
  slug: string;
  title_en: string;
  title_ar?: string | null;
  category?: string | null;
  doc_no?: string | null;
  department_owner?: string | null;
  version?: number;
  revision_no?: string | null;
  revision_date?: string | null;
  schema: HrTemplateSchema;
  status?: string;
  requires_approval?: boolean;
}

export function useCreateTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TemplateInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await db
        .from("hr_form_templates")
        .insert({ ...input, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as HrFormTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hrFormTemplates.all });
      toast.success("Template created");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TemplateInput> }) => {
      const { error } = await db.from("hr_form_templates").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hrFormTemplates.all });
      toast.success("Template updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("hr_form_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hrFormTemplates.all });
      toast.success("Template moved to trash");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export function useHrFormSubmissionsQuery() {
  return useQuery({
    queryKey: queryKeys.hrFormSubmissions.list(),
    queryFn: async (): Promise<HrFormSubmission[]> => {
      const { data, error } = await db
        .from("hr_form_submissions")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HrFormSubmission[];
    },
    staleTime: 60 * 1000,
  });
}

export interface SubmissionInput {
  template_id: string;
  employee_id?: string | null;
  data: HrFormSubmission["data"];
  status?: HrSubmissionStatus;
}

export function useSaveSubmissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: SubmissionInput }) => {
      if (id) {
        const { data, error } = await db
          .from("hr_form_submissions")
          .update({ employee_id: input.employee_id, data: input.data })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as HrFormSubmission;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await db
        .from("hr_form_submissions")
        .insert({ ...input, requested_by: user.id, requested_by_email: user.email })
        .select()
        .single();
      if (error) throw error;
      return data as HrFormSubmission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hrFormSubmissions.all });
      toast.success("Draft saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteSubmissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("hr_form_submissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hrFormSubmissions.all });
      toast.success("Draft deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
