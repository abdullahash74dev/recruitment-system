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

// ---------------------------------------------------------------------------
// Workflow: submit → approve/reject → issue
// ---------------------------------------------------------------------------

/** Best-effort in-app notification; RLS only lets us notify ourselves unless admin. */
async function notify(userId: string, title: string, body: string, link: string) {
  try {
    await db.from("notifications").insert({
      user_id: userId, type: "hr_forms", title, body, link, severity: "info",
    });
  } catch {
    // Notifications are a convenience — never block the workflow on them.
  }
}

export function useSubmitSubmissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("hr_form_submissions")
        .update({ status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hrFormSubmissions.all });
      toast.success("Submitted for approval");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDecideSubmissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ submission, decision, reason }: {
      submission: HrFormSubmission;
      decision: "approved" | "rejected";
      reason?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await db
        .from("hr_form_submissions")
        .update({
          status: decision,
          decided_by: user.id,
          decided_by_email: user.email,
          decided_at: new Date().toISOString(),
          rejection_reason: decision === "rejected" ? (reason ?? null) : null,
        })
        .eq("id", submission.id);
      if (error) throw error;
      await notify(
        submission.requested_by,
        decision === "approved" ? "Form request approved" : "Form request rejected",
        decision === "rejected" && reason ? `Reason: ${reason}` : "Open HR Forms to view the request.",
        `/admin/hr-forms/fill/${submission.template_id}?submission=${submission.id}`,
      );
    },
    onSuccess: (_, { decision }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hrFormSubmissions.all });
      toast.success(decision === "approved" ? "Request approved" : "Request rejected");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export interface IssueFilesInput {
  submission: HrFormSubmission;
  templateTitle: string;
  employeeName: string | null;
  /** format -> file blob; uploaded to the hr-form-documents bucket. */
  files: Record<string, Blob>;
}

const FILE_EXTENSIONS: Record<string, string> = { pdf: "pdf", xlsx: "xlsx", docx: "docx", png: "png" };

export function useIssueSubmissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ submission, templateTitle, employeeName, files }: IssueFilesInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const urls: Record<string, string> = {};
      for (const [format, blob] of Object.entries(files)) {
        const ext = FILE_EXTENSIONS[format] ?? format;
        const path = `${submission.id}/${format}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("hr-form-documents")
          .upload(path, blob, { upsert: true, contentType: blob.type || undefined });
        if (upErr) throw new Error(`Upload failed (${format}): ${upErr.message}`);
        urls[format] = path;
      }

      const { error } = await db
        .from("hr_form_submissions")
        .update({
          status: "issued",
          issued_at: new Date().toISOString(),
          issued_by: user.id,
          issued_file_pdf_url: urls.pdf ?? null,
          issued_file_xlsx_url: urls.xlsx ?? null,
          issued_file_docx_url: urls.docx ?? null,
          issued_file_png_url: urls.png ?? null,
        })
        .eq("id", submission.id);
      if (error) throw error;

      const { error: ledgerErr } = await db.from("hr_form_issuances").insert({
        submission_id: submission.id,
        template_id: submission.template_id,
        template_title: templateTitle,
        employee_id: submission.employee_id,
        employee_name: employeeName,
        issued_by: user.id,
        issued_by_email: user.email,
        formats: Object.keys(urls),
        file_urls: urls,
      });
      if (ledgerErr) throw ledgerErr;

      await notify(
        submission.requested_by,
        "Form issued",
        `${templateTitle} has been issued and archived.`,
        `/admin/hr-forms/fill/${submission.template_id}?submission=${submission.id}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hrFormSubmissions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.hrFormIssuances.all });
      toast.success("Form issued and archived");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// ---------------------------------------------------------------------------
// Per-template fill grants
// ---------------------------------------------------------------------------

export interface TemplatePermission {
  id: string;
  template_id: string;
  user_id: string;
  can_fill: boolean;
  granted_by: string;
  created_at: string;
}

export function useTemplatePermissionsQuery() {
  return useQuery({
    queryKey: queryKeys.hrFormTemplatePermissions.list(),
    queryFn: async (): Promise<TemplatePermission[]> => {
      const { data, error } = await db
        .from("hr_form_template_permissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TemplatePermission[];
    },
    staleTime: 60 * 1000,
  });
}

export function useGrantTemplatePermissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, userId }: { templateId: string; userId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await db.from("hr_form_template_permissions").insert({
        template_id: templateId, user_id: userId, granted_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hrFormTemplatePermissions.all });
      toast.success("Access granted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRevokeTemplatePermissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (grantId: string) => {
      const { error } = await db.from("hr_form_template_permissions").delete().eq("id", grantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hrFormTemplatePermissions.all });
      toast.success("Access revoked");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// ---------------------------------------------------------------------------
// Issuance ledger (usage log)
// ---------------------------------------------------------------------------

export interface HrFormIssuance {
  id: string;
  submission_id: string;
  template_id: string;
  template_title: string;
  employee_id: string | null;
  employee_name: string | null;
  issued_by: string;
  issued_by_email: string | null;
  formats: string[];
  file_urls: Record<string, string>;
  issued_at: string;
}

export function useHrFormIssuancesQuery() {
  return useQuery({
    queryKey: queryKeys.hrFormIssuances.list(),
    queryFn: async (): Promise<HrFormIssuance[]> => {
      const { data, error } = await db
        .from("hr_form_issuances")
        .select("*")
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HrFormIssuance[];
    },
    staleTime: 60 * 1000,
  });
}

/** Signed URL for a stored issued document (private bucket). */
export async function getIssuedFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("hr-form-documents")
    .createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) throw error ?? new Error("Could not sign URL");
  return data.signedUrl;
}
