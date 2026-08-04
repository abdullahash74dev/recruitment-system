// Fill-and-export screen: pick an employee (auto-fills every
// source="employee" field), complete the rest, save as draft, and download
// as PDF/Excel. A hidden fixed-width print render of the same form is what
// the PDF/image capture uses, so output matches the screen exactly.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import {
  useEmployeesQuery,
  useHrFormSubmissionsQuery,
  useHrFormTemplatesQuery,
  useSaveSubmissionMutation,
} from "@/hooks/queries/useHrForms";
import { missingRequiredFields, resolveForm } from "@/lib/hrForms/templateEngine";
import type { Employee, HrFieldValue } from "@/lib/hrForms/types";
import FormRenderer from "@/components/HrForms/FormRenderer/FormRenderer";
import EmployeePicker from "@/components/HrForms/EmployeePicker";
import ExportMenu from "@/components/HrForms/ExportMenu";

const FillFormPage = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const submissionId = searchParams.get("submission");
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { settings } = useSiteSettings();

  const { data: templates = [], isLoading: templatesLoading } = useHrFormTemplatesQuery();
  const { data: submissions = [] } = useHrFormSubmissionsQuery();
  const { data: employees = [] } = useEmployeesQuery();
  const saveSubmission = useSaveSubmissionMutation();

  const template = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  const existing = useMemo(() => submissions.find((s) => s.id === submissionId) ?? null, [submissions, submissionId]);

  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, HrFieldValue>>({});
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const loadedSubmissionRef = useRef<string | null>(null);

  // Hydrate state from an existing draft exactly once per submission id.
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

  const onFieldChange = (key: string, value: HrFieldValue) => {
    setData((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const onPickEmployee = (emp: Employee | null) => {
    setEmployeeId(emp?.id ?? null);
    setDirty(true);
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
    const saved = await saveSubmission.mutateAsync({
      id: existing?.id,
      input: { template_id: template.id, employee_id: employeeId, data },
    });
    setDirty(false);
    if (!existing) setSearchParams({ submission: saved.id }, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/hr-forms/catalog")}>
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-lg font-bold truncate">{template.title_en}</h2>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {template.doc_no && <span>{template.doc_no}</span>}
            <span>Rev. {template.revision_no ?? template.version}</span>
            {dirty && <Badge variant="outline" className="text-amber-600">{lang === "ar" ? "غير محفوظ" : "Unsaved"}</Badge>}
          </div>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => setPreview((p) => !p)}>
            {preview ? <Pencil className="h-4 w-4 me-2" /> : <Eye className="h-4 w-4 me-2" />}
            {preview ? (lang === "ar" ? "تحرير" : "Edit") : (lang === "ar" ? "معاينة" : "Preview")}
          </Button>
          <Button onClick={saveDraft} disabled={saveSubmission.isPending}>
            <Save className="h-4 w-4 me-2" />
            {lang === "ar" ? "حفظ مسودة" : "Save Draft"}
          </Button>
          <ExportMenu resolved={resolved} getPrintNode={() => printRef.current} lang={lang} />
        </div>
      </div>

      <div className="max-w-md">
        <div className="text-xs font-medium text-muted-foreground mb-1">
          {lang === "ar" ? "الموظف (تعبئة تلقائية للحقول المشتركة)" : "Employee (auto-fills shared fields)"}
        </div>
        <EmployeePicker value={employeeId} onChange={onPickEmployee} lang={lang} />
      </div>

      <FormRenderer
        resolved={resolved}
        lang={lang}
        mode={preview ? "print" : "edit"}
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
    </div>
  );
};

export default FillFormPage;
