// Admin approvals inbox: every submission waiting for a decision, plus the
// approved queue waiting for issuance. Opening a row goes to the form's
// review screen where Approve/Reject/Issue actions live.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useEmployeesQuery, useHrFormSubmissionsQuery, useHrFormTemplatesQuery } from "@/hooks/queries/useHrForms";

const ApprovalsInboxPage = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { role } = useUserPermissions();
  const { data: submissions = [], isLoading } = useHrFormSubmissionsQuery();
  const { data: templates = [] } = useHrFormTemplatesQuery();
  const { data: employees = [] } = useEmployeesQuery();

  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const pending = useMemo(() => submissions.filter((s) => s.status === "submitted"), [submissions]);
  const awaitingIssue = useMemo(() => submissions.filter((s) => s.status === "approved"), [submissions]);

  if (role !== "admin") {
    return <div className="text-center py-12 text-muted-foreground">{lang === "ar" ? "صندوق الاعتماد لمدير النظام فقط." : "The approvals inbox is restricted to administrators."}</div>;
  }

  const renderList = (items: typeof submissions, emptyEn: string, emptyAr: string) => (
    <div className="border border-border rounded-md divide-y divide-border">
      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-muted-foreground text-sm">{lang === "ar" ? emptyAr : emptyEn}</div>
      ) : (
        items.map((s) => {
          const t = templateById.get(s.template_id);
          const emp = s.employee_id ? employeeById.get(s.employee_id) : null;
          return (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">{t?.title_en ?? "—"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[
                    emp?.full_name_en,
                    s.requested_by_email,
                    s.submitted_at ? new Date(s.submitted_at).toLocaleString() : null,
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
              <Button
                className="ms-auto shrink-0"
                size="sm"
                onClick={() => navigate(`/admin/hr-forms/fill/${s.template_id}?submission=${s.id}`)}
              >
                {lang === "ar" ? "مراجعة" : "Review"}
              </Button>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-amber-500" />
        <h2 className="text-xl font-bold">{lang === "ar" ? "بانتظار الاعتماد" : "Awaiting Approval"}</h2>
        <Badge variant="secondary">{pending.length}</Badge>
      </div>
      {isLoading
        ? <div className="text-muted-foreground text-sm">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</div>
        : renderList(pending, "No requests awaiting approval.", "لا توجد طلبات بانتظار الاعتماد.")}

      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-blue-500" />
        <h2 className="text-xl font-bold">{lang === "ar" ? "معتمدة بانتظار الإصدار" : "Approved, Awaiting Issuance"}</h2>
        <Badge variant="secondary">{awaitingIssue.length}</Badge>
      </div>
      {renderList(awaitingIssue, "Nothing awaiting issuance.", "لا يوجد شيء بانتظار الإصدار.")}
    </div>
  );
};

export default ApprovalsInboxPage;
