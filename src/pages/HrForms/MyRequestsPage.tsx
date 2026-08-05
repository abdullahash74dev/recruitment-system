// The requester's own submissions across every lifecycle state, with quick
// navigation back into each form.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEmployeesQuery, useHrFormSubmissionsQuery, useHrFormTemplatesQuery } from "@/hooks/queries/useHrForms";
import type { HrSubmissionStatus } from "@/lib/hrForms/types";

const STATUS_STYLE: Record<HrSubmissionStatus, string> = {
  draft: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  submitted: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
  issued: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-slate-500/15 text-slate-500",
};

const MyRequestsPage = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { data: submissions = [], isLoading } = useHrFormSubmissionsQuery();
  const { data: templates = [] } = useHrFormTemplatesQuery();
  const { data: employees = [] } = useEmployeesQuery();

  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{lang === "ar" ? "طلباتي" : "My Requests"}</h2>
      <div className="border border-border rounded-md divide-y divide-border">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</div>
        ) : submissions.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            {lang === "ar" ? "لا توجد طلبات بعد — ابدأ من دليل النماذج." : "No requests yet — start from the Forms Catalog."}
          </div>
        ) : (
          submissions.map((s) => {
            const t = templateById.get(s.template_id);
            const emp = s.employee_id ? employeeById.get(s.employee_id) : null;
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{t?.title_en ?? "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[emp?.full_name_en, new Date(s.updated_at).toLocaleString()].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ms-auto h-8 w-8 shrink-0"
                  onClick={() => navigate(`/admin/hr-forms/fill/${s.template_id}?submission=${s.id}`)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MyRequestsPage;
