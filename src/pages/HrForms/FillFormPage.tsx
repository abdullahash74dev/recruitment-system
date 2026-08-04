// Fill-and-workflow screen for one form: pick an employee (auto-fills every
// source="employee" field), save drafts, export in any format, and drive the
// full lifecycle — submit for approval, admin approve/reject, and PIN-gated
// issuance that archives all four formats to protected storage.
// A hidden fixed-width print render of the same form feeds PDF/PNG capture.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, FileCheck2, Pencil, Save, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useDeletePin } from "@/components/DeletePinDialog";
import {
  useDecideSubmissionMutation,
  useEmployeesQuery,
  useHrFormSubmissionsQuery,
  useHrFormTemplatesQuery,
  useIssueSubmissionMutation,
  useSaveSubmissionMutation,
  useSubmitSubmissionMutation,
} from "@/hooks/queries/useHrForms";
import { missingRequiredFields, resolveForm } from "@/lib/hrForms/templateEngine";
import type { Employee, HrFieldValue, HrSubmissionStatus } from "@/lib/hrForms/types";
import FormRenderer from "@/components/HrForms/FormRenderer/FormRenderer";
import EmployeePicker from "@/components/HrForms/EmployeePicker";
import ExportMenu, { buildAllFormatBlobs } from "@/components/HrForms/ExportMenu";

const STATUS_STYLE: Record<HrSubmissionStatus, string> = {
  draft: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  submitted: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
  issued: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-slate-500/15 text-slate-500",
};

const FillFormPage = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const submissionId = searchParams.get("submission");
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { settings } = useSiteSettings();
  const { role } = useUserPermissions();
  const isAdmin = role === "admin";
  const { requestDelete: requestPin } = useDeletePin();

  const { data: templates = [], isLoading: templatesLoading } = useHrFormTemplatesQuery();
  const { data: submissions = [] } = useHrFormSubmissionsQuery();
  const { data: employees = [] } = useEmployeesQuery();
  const saveSubmission = useSaveSubmissionMutation();
  const submitSubmission = useSubmitSubmissionMutation();
  const decideSubmission = useDecideSubmissionMutation();
  const issueSubmission = useIssueSubmissionMutation();

  const template = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  const existing = useMemo(() => submissions.find((s) => s.id === submissionId) ?? null, [submissions, submissionId]);

  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, HrFieldValue>>({});
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [issuing, setIssuing] = useState(false);
  const loadedSubmissionRef = useRef<string | null>(null);

  // Hydrate state from an existing submission exactly once per id.
  useEffect(() => {
    if (existing && loadedSubmissionRef.current !== existing.id) {
      loadedSubmissionRef.current = existing.id;
      setEmployeeId(existing.employee_id);
      setData(existing.data ?? {});
      setDirty(false);
    }
  }, [existing]);

  const employee: Employee | null = useMemo(
    () => employees.find((e) => e.id === employeeId) ?? null,
    [employees, employeeId],
  );

  const resolved = useMemo(
    () => (template ? resolveForm(template, employee, data, settings) : null),
    [template, employee, data, settings],
  );

  const printRef = useRef<HTMLDivElement>(null);

  if (templatesLoading) {
    return <div className="text-muted-foreground text-sm py-12 text-center">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</div>;
  }
  if (!template || !resolved) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">{lang === "ar" ? "النموذج غير موجود." : "Form not found."}</p>
        <Button variant="outline" onClick={() => navigate("/admin/hr-forms/catalog")}>
          {lang === "ar" ? "العودة للدليل" : "Back to catalog"}
        </Button>
      </div>
    );
  }

  const status: HrSubmissionStatus = existing?.status ?? "draft";
  // Editing is allowed on new forms, own drafts, and rejected requests being fixed.
  const editable = !existing || status === "draft" || status === "rejected";
  const showEditor = editable && !preview;

  const onFieldChange = (key: string, value: HrFieldValue) => {
    setData((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const persist = async (): Promise<string | null> => {
    const saved = await saveSubmission.mutateAsync({
      id: existing?.id,
      input: { template_id: template.id, employee_id: employeeId, data },
    });
    setDirty(false);
    if (!existing) setSearchParams({ submission: saved.id }, { replace: true });
    return saved?.id ?? existing?.id ?? null;
  };

  const saveDraft = async () => {
    const missing = missingRequiredFields(template, resolved.values);
    if (missing.length > 0) {
      toast.warning(
        lang === "ar"
          ? `حقول إلزامية ناقصة: ${missing.map((f) => f.label_ar || f.label_en).join("، ")}`
          : `Missing required fields: ${missing.map((f) => f.label_en).join(", ")}`,
      );
    }
    await persist();
  };

  const submitForApproval = async () => {
    const missing = missingRequiredFields(template, resolved.values);
    if (missing.length > 0) {
      toast.error(
        lang === "ar"
          ? `أكمل الحقول الإلزامية أولًا: ${missing.map((f) => f.label_ar || f.label_en).join("، ")}`
          : `Complete required fields first: ${missing.map((f) => f.label_en).join(", ")}`,
      );
      return;
    }
    const id = await persist();
    if (id) await submitSubmission.mutateAsync(id);
  };

  const issue = () => {
    if (!existing) return;
    requestPin({
      message:
        lang === "ar"
          ? "إصدار النموذج نهائيًا وأرشفة نسخه (PDF/Excel/Word/صورة) يتطلب الرقم السري."
          : "Final issuance archives all formats (PDF/Excel/Word/Image) and requires the security PIN.",
      onConfirm: async () => {
        const node = printRef.current;
        if (!node) {
          toast.error("Print view is not ready");
          return;
        }
        setIssuing(true);
        try {
          const files = await buildAllFormatBlobs(resolved, node, lang);
          await issueSubmission.mutateAsync({
            submission: existing,
            templateTitle: template.title_en,
            employeeName: employee?.full_name_en ?? null,
            files,
          });
        } finally {
          setIssuing(false);
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/hr-forms/catalog")}>
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-lg font-bold truncate">{template.title_en}</h2>
          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            {template.doc_no && <span>{template.doc_no}</span>}
            <span>Rev. {template.revision_no ?? template.version}</span>
            <span className={`px-2 py-0.5 rounded-full ${STATUS_STYLE[status]}`}>{status}</span>
            {status === "rejected" && existing?.rejection_reason && (
              <span className="text-red-500">{lang === "ar" ? "سبب الرفض:" : "Rejected:"} {existing.rejection_reason}</span>
            )}
            {dirty && <Badge variant="outline" className="text-amber-600">{lang === "ar" ? "غير محفوظ" : "Unsaved"}</Badge>}
          </div>
        </div>
        <div className="ms-auto flex items-center gap-2 flex-wrap">
          {editable && (
            <Button variant="outline" onClick={() => setPreview((p) => !p)}>
              {preview ? <Pencil className="h-4 w-4 me-2" /> : <Eye className="h-4 w-4 me-2" />}
              {preview ? (lang === "ar" ? "تحرير" : "Edit") : (lang === "ar" ? "معاينة" : "Preview")}
            </Button>
          )}
          {editable && (
            <Button onClick={saveDraft} disabled={saveSubmission.isPending}>
              <Save className="h-4 w-4 me-2" />
              {lang === "ar" ? "حفظ مسودة" : "Save Draft"}
            </Button>
          )}
          {editable && template.requires_approval && (
            <Button variant="secondary" onClick={submitForApproval} disabled={saveSubmission.isPending || submitSubmission.isPending}>
              <Send className="h-4 w-4 me-2" />
              {lang === "ar" ? "إرسال للاعتماد" : "Submit for Approval"}
            </Button>
          )}
          {isAdmin && status === "submitted" && existing && (
            <>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => decideSubmission.mutate({ submission: existing, decision: "approved" })}
                disabled={decideSubmission.isPending}
              >
                <CheckCircle2 className="h-4 w-4 me-2" />
                {lang === "ar" ? "اعتماد" : "Approve"}
              </Button>
              <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={decideSubmission.isPending}>
                <XCircle className="h-4 w-4 me-2" />
                {lang === "ar" ? "رفض" : "Reject"}
              </Button>
            </>
          )}
          {isAdmin && existing && (status === "approved" || (!template.requires_approval && status === "draft" && !dirty)) && (
            <Button onClick={issue} disabled={issuing || issueSubmission.isPending}>
              <FileCheck2 className="h-4 w-4 me-2" />
              {issuing ? (lang === "ar" ? "جارٍ الإصدار..." : "Issuing...") : (lang === "ar" ? "إصدار وأرشفة" : "Issue & Archive")}
            </Button>
          )}
          <ExportMenu resolved={resolved} getPrintNode={() => printRef.current} lang={lang} />
        </div>
      </div>

      {editable && (
        <div className="max-w-md">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            {lang === "ar" ? "الموظف (تعبئة تلقائية للحقول المشتركة)" : "Employee (auto-fills shared fields)"}
          </div>
          <EmployeePicker
            value={employeeId}
            onChange={(emp) => { setEmployeeId(emp?.id ?? null); setDirty(true); }}
            lang={lang}
          />
        </div>
      )}

      <FormRenderer
        resolved={resolved}
        lang={lang}
        mode={showEditor ? "edit" : "print"}
        onFieldChange={onFieldChange}
      />

      {/* Hidden fixed-width print copy captured by the PDF/image exporter.
          The theme CSS variables are locally overridden to light values so an
          exported document always prints on white, even in dark mode. */}
      <div className="fixed -start-[10000px] top-0 pointer-events-none" aria-hidden>
        <div
          ref={printRef}
          className="w-[820px] bg-background text-foreground p-6"
          style={{
            "--background": "0 0% 100%",
            "--foreground": "222 47% 11%",
            "--muted": "210 40% 96%",
            "--muted-foreground": "215 16% 40%",
            "--border": "214 32% 85%",
            "--card": "0 0% 100%",
            "--primary": "222 47% 20%",
            "--destructive": "0 84% 50%",
          } as React.CSSProperties}
        >
          <FormRenderer resolved={resolved} lang={lang} mode="print" />
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "رفض الطلب" : "Reject Request"}</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={lang === "ar" ? "سبب الرفض (يظهر لمقدم الطلب)" : "Rejection reason (shown to the requester)"}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (existing) decideSubmission.mutate({ submission: existing, decision: "rejected", reason: rejectReason.trim() || undefined });
                setRejectOpen(false);
                setRejectReason("");
              }}
            >
              {lang === "ar" ? "تأكيد الرفض" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FillFormPage;
