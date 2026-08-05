// Admin-only template management: list every template (all versions),
// create new ones from scratch, duplicate to a new revision, publish/archive,
// and jump into the schema editor. Structure editing is the one capability
// deliberately reserved for admins.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  useCreateTemplateMutation,
  useDeleteTemplateMutation,
  useHrFormTemplatesQuery,
  useUpdateTemplateMutation,
} from "@/hooks/queries/useHrForms";
import type { HrFormTemplate } from "@/lib/hrForms/types";

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  published: "default",
  draft: "secondary",
  archived: "outline",
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

const TemplateBuilderListPage = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { role } = useUserPermissions();
  const { data: templates = [], isLoading } = useHrFormTemplatesQuery();
  const createTemplate = useCreateTemplateMutation();
  const updateTemplate = useUpdateTemplateMutation();
  const deleteTemplate = useDeleteTemplateMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTitleAr, setNewTitleAr] = useState("");
  const [newDocNo, setNewDocNo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<HrFormTemplate | null>(null);

  const sorted = useMemo(
    () => [...templates].sort((a, b) => (a.doc_no ?? a.slug).localeCompare(b.doc_no ?? b.slug) || b.version - a.version),
    [templates],
  );

  if (role !== "admin") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {lang === "ar" ? "إدارة القوالب متاحة لمدير النظام فقط." : "Template management is restricted to administrators."}
      </div>
    );
  }

  const create = async () => {
    if (!newTitle.trim()) return;
    const created = await createTemplate.mutateAsync({
      slug: slugify(newTitle) || `form-${Date.now()}`,
      title_en: newTitle.trim(),
      title_ar: newTitleAr.trim() || null,
      doc_no: newDocNo.trim() || null,
      department_owner: "HR",
      schema: { sections: [] },
      status: "draft",
    });
    setCreateOpen(false);
    setNewTitle(""); setNewTitleAr(""); setNewDocNo("");
    navigate(`/admin/hr-forms/templates/${created.id}`);
  };

  const duplicateAsNewVersion = async (t: HrFormTemplate) => {
    const maxVersion = Math.max(...templates.filter((x) => x.slug === t.slug).map((x) => x.version));
    const created = await createTemplate.mutateAsync({
      slug: t.slug,
      title_en: t.title_en,
      title_ar: t.title_ar,
      category: t.category,
      doc_no: t.doc_no,
      department_owner: t.department_owner,
      version: maxVersion + 1,
      revision_no: String(maxVersion + 1),
      revision_date: new Date().toISOString().slice(0, 10),
      schema: t.schema,
      status: "draft",
      requires_approval: t.requires_approval,
    });
    navigate(`/admin/hr-forms/templates/${created.id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold">{lang === "ar" ? "منشئ القوالب" : "Template Builder"}</h2>
        <Badge variant="secondary">{templates.length}</Badge>
        <Button className="ms-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 me-1" />
          {lang === "ar" ? "قالب جديد" : "New Template"}
        </Button>
      </div>

      <div className="border border-border rounded-md divide-y divide-border">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</div>
        ) : sorted.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            {lang === "ar" ? "لا توجد قوالب بعد." : "No templates yet."}
          </div>
        ) : (
          sorted.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {t.title_en}
                  {t.title_ar && <span dir="rtl" className="ms-2 text-sm text-muted-foreground">{t.title_ar}</span>}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  {t.doc_no && <span>{t.doc_no}</span>}
                  <span>v{t.version}</span>
                  {t.category && <span>{t.category}</span>}
                  {t.is_system_seed && <span>{lang === "ar" ? "قالب أساسي" : "system seed"}</span>}
                </div>
              </div>
              <Badge variant={STATUS_BADGE[t.status]} className="shrink-0">{t.status}</Badge>
              <div className="ms-auto flex items-center gap-1 shrink-0">
                {t.status !== "published" ? (
                  <Button variant="outline" size="sm" onClick={() => updateTemplate.mutate({ id: t.id, patch: { status: "published" } })}>
                    {lang === "ar" ? "نشر" : "Publish"}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => updateTemplate.mutate({ id: t.id, patch: { status: "archived" } })}>
                    {lang === "ar" ? "أرشفة" : "Archive"}
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" title={lang === "ar" ? "مراجعة جديدة" : "New revision"} onClick={() => duplicateAsNewVersion(t)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/hr-forms/templates/${t.id}`)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(t)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "قالب جديد" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{lang === "ar" ? "العنوان (إنجليزي)" : "Title (EN)"}</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Overtime Request" />
            </div>
            <div className="space-y-1">
              <Label>{lang === "ar" ? "العنوان (عربي)" : "Title (AR)"}</Label>
              <Input dir="rtl" value={newTitleAr} onChange={(e) => setNewTitleAr(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{lang === "ar" ? "رقم النموذج" : "Document No."}</Label>
              <Input dir="ltr" value={newDocNo} onChange={(e) => setNewDocNo(e.target.value)} placeholder="HR-FRM-009" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={create} disabled={!newTitle.trim() || createTemplate.isPending}>
              {lang === "ar" ? "إنشاء والانتقال للمحرر" : "Create & open editor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang === "ar" ? "حذف القالب؟" : "Delete template?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "ar"
                ? `سيُنقل «${deleteTarget?.title_en}» (v${deleteTarget?.version}) إلى سلة المحذوفات.`
                : `"${deleteTarget?.title_en}" (v${deleteTarget?.version}) will be moved to Trash.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteTemplate.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {lang === "ar" ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TemplateBuilderListPage;
