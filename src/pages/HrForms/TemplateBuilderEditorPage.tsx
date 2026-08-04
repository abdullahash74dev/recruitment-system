// Admin schema editor for one template: document-control metadata + the
// section/field structure, with a live preview rendered by the exact same
// engine the fill screen uses.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useHrFormTemplatesQuery, useUpdateTemplateMutation, type TemplateInput } from "@/hooks/queries/useHrForms";
import { resolveForm } from "@/lib/hrForms/templateEngine";
import type { HrTemplateSchema } from "@/lib/hrForms/types";
import TemplateSchemaEditor from "@/components/HrForms/Builder/TemplateSchemaEditor";
import FormRenderer from "@/components/HrForms/FormRenderer/FormRenderer";

const TemplateBuilderEditorPage = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { settings } = useSiteSettings();
  const { role } = useUserPermissions();

  const { data: templates = [], isLoading } = useHrFormTemplatesQuery();
  const updateTemplate = useUpdateTemplateMutation();
  const template = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);

  const [meta, setMeta] = useState<Partial<TemplateInput>>({});
  const [schema, setSchema] = useState<HrTemplateSchema>({ sections: [] });
  const [dirty, setDirty] = useState(false);
  const hydratedRef = useRef<string | null>(null);

  useEffect(() => {
    if (template && hydratedRef.current !== template.id) {
      hydratedRef.current = template.id;
      setMeta({
        title_en: template.title_en,
        title_ar: template.title_ar,
        category: template.category,
        doc_no: template.doc_no,
        department_owner: template.department_owner,
        revision_no: template.revision_no,
        revision_date: template.revision_date,
      });
      setSchema(template.schema ?? { sections: [] });
      setDirty(false);
    }
  }, [template]);

  const previewTemplate = useMemo(
    () => (template ? { ...template, ...meta, schema } : null),
    [template, meta, schema],
  );

  if (role !== "admin") {
    return <div className="text-center py-12 text-muted-foreground">{lang === "ar" ? "لمدير النظام فقط." : "Administrators only."}</div>;
  }
  if (isLoading) {
    return <div className="text-muted-foreground text-sm py-12 text-center">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</div>;
  }
  if (!template || !previewTemplate) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">{lang === "ar" ? "القالب غير موجود." : "Template not found."}</p>
        <Button variant="outline" onClick={() => navigate("/admin/hr-forms/templates")}>
          {lang === "ar" ? "العودة" : "Back"}
        </Button>
      </div>
    );
  }

  const setMetaField = (patch: Partial<TemplateInput>) => {
    setMeta((m) => ({ ...m, ...patch }));
    setDirty(true);
  };

  const save = async () => {
    await updateTemplate.mutateAsync({ id: template.id, patch: { ...meta, schema } });
    setDirty(false);
  };

  const metaInput = (key: keyof TemplateInput, labelEn: string, labelAr: string, dir?: "ltr" | "rtl", type = "text") => (
    <div className="space-y-1">
      <Label className="text-xs">{lang === "ar" ? labelAr : labelEn}</Label>
      <Input
        type={type}
        dir={dir}
        value={(meta[key] as string | null) ?? ""}
        onChange={(e) => setMetaField({ [key]: e.target.value || null })}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/hr-forms/templates")}>
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-lg font-bold truncate">{meta.title_en ?? template.title_en}</h2>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>v{template.version}</span>
            <Badge variant={template.status === "published" ? "default" : "secondary"}>{template.status}</Badge>
            {template.status === "published" && (
              <span>{lang === "ar" ? "تنبيه: التعديلات تطبق على النسخة المنشورة مباشرة" : "Note: edits apply to the live published version"}</span>
            )}
            {dirty && <Badge variant="outline" className="text-amber-600">{lang === "ar" ? "غير محفوظ" : "Unsaved"}</Badge>}
          </div>
        </div>
        <Button className="ms-auto" onClick={save} disabled={updateTemplate.isPending}>
          <Save className="h-4 w-4 me-2" />
          {lang === "ar" ? "حفظ القالب" : "Save Template"}
        </Button>
      </div>

      <Tabs defaultValue="structure">
        <TabsList>
          <TabsTrigger value="structure">{lang === "ar" ? "الهيكل" : "Structure"}</TabsTrigger>
          <TabsTrigger value="meta">{lang === "ar" ? "بيانات الوثيقة" : "Document Info"}</TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 me-1" />
            {lang === "ar" ? "معاينة" : "Preview"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="pt-4">
          <TemplateSchemaEditor
            schema={schema}
            onChange={(s) => { setSchema(s); setDirty(true); }}
            lang={lang}
          />
        </TabsContent>

        <TabsContent value="meta" className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            {metaInput("title_en", "Title (EN)", "العنوان (إنجليزي)")}
            {metaInput("title_ar", "Title (AR)", "العنوان (عربي)", "rtl")}
            {metaInput("doc_no", "Document No.", "رقم النموذج", "ltr")}
            {metaInput("category", "Category", "التصنيف")}
            {metaInput("department_owner", "Owning Department", "الإدارة المالكة")}
            {metaInput("revision_no", "Revision No.", "رقم المراجعة", "ltr")}
            {metaInput("revision_date", "Revision Date", "تاريخ المراجعة", "ltr", "date")}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="pt-4">
          <FormRenderer
            resolved={resolveForm(previewTemplate, null, {}, settings)}
            lang={lang}
            mode="print"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TemplateBuilderEditorPage;
