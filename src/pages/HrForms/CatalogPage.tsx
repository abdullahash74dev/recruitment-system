// Forms catalog: latest published version of every template, searchable, with
// the user's recent drafts underneath so a half-filled form is one click away.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Pencil, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  latestTemplates,
  useDeleteSubmissionMutation,
  useEmployeesQuery,
  useHrFormSubmissionsQuery,
  useHrFormTemplatesQuery,
} from "@/hooks/queries/useHrForms";

const CatalogPage = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: templates = [], isLoading } = useHrFormTemplatesQuery();
  const { data: submissions = [] } = useHrFormSubmissionsQuery();
  const { data: employees = [] } = useEmployeesQuery();
  const deleteSubmission = useDeleteSubmissionMutation();

  const published = useMemo(
    () =>
      latestTemplates(templates.filter((t) => t.status === "published")).filter((t) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [t.title_en, t.title_ar, t.doc_no, t.category].some((s) => s?.toLowerCase().includes(q));
      }),
    [templates, search],
  );

  const drafts = useMemo(() => submissions.filter((s) => s.status === "draft").slice(0, 10), [submissions]);
  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold">{lang === "ar" ? "دليل النماذج" : "Forms Catalog"}</h2>
        <div className="relative ms-auto w-full sm:w-72">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-8"
            placeholder={lang === "ar" ? "ابحث عن نموذج..." : "Search forms..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm py-12 text-center">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</div>
      ) : published.length === 0 ? (
        <div className="text-muted-foreground text-sm py-12 text-center">
          {lang === "ar" ? "لا توجد نماذج منشورة بعد." : "No published forms yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {published.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">
                    {t.title_en}
                    {t.title_ar && <span dir="rtl" className="block text-sm font-normal text-muted-foreground">{t.title_ar}</span>}
                  </CardTitle>
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {t.doc_no && <Badge variant="outline">{t.doc_no}</Badge>}
                  {t.category && <Badge variant="secondary">{t.category}</Badge>}
                  <span>Rev. {t.revision_no ?? t.version}</span>
                </div>
                <Button className="w-full" onClick={() => navigate(`/admin/hr-forms/fill/${t.id}`)}>
                  {lang === "ar" ? "تعبئة النموذج" : "Fill Form"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">{lang === "ar" ? "مسوداتي الأخيرة" : "My Recent Drafts"}</h3>
          <div className="border border-border rounded-md divide-y divide-border">
            {drafts.map((d) => {
              const t = templateById.get(d.template_id);
              const emp = d.employee_id ? employeeById.get(d.employee_id) : null;
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t?.title_en ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[emp?.full_name_en, new Date(d.updated_at).toLocaleString()].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="ms-auto flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => navigate(`/admin/hr-forms/fill/${d.template_id}?submission=${d.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteSubmission.mutate(d.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogPage;
