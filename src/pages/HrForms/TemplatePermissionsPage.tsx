// Admin-only per-template access control: grant a specific user fill-only
// access to one specific template (structure editing always stays admin-only,
// and admins/HR roles can fill everything without grants).

import { useMemo, useState } from "react";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useProfilesQuery } from "@/hooks/queries/useUsersAndRoles";
import {
  latestTemplates,
  useGrantTemplatePermissionMutation,
  useHrFormTemplatesQuery,
  useRevokeTemplatePermissionMutation,
  useTemplatePermissionsQuery,
} from "@/hooks/queries/useHrForms";

interface ProfileRow {
  user_id: string;
  display_name?: string | null;
  email?: string | null;
}

const TemplatePermissionsPage = () => {
  const { lang } = useLanguage();
  const { role } = useUserPermissions();
  const { data: templates = [] } = useHrFormTemplatesQuery();
  const { data: grants = [], isLoading } = useTemplatePermissionsQuery();
  const { data: profiles = [] } = useProfilesQuery();
  const grantPermission = useGrantTemplatePermissionMutation();
  const revokePermission = useRevokeTemplatePermissionMutation();

  const [templateId, setTemplateId] = useState("");
  const [userId, setUserId] = useState("");

  const published = useMemo(() => latestTemplates(templates.filter((t) => t.status === "published")), [templates]);
  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);
  const profileByUserId = useMemo(
    () => new Map((profiles as ProfileRow[]).map((p) => [p.user_id, p])),
    [profiles],
  );

  if (role !== "admin") {
    return <div className="text-center py-12 text-muted-foreground">{lang === "ar" ? "إدارة الصلاحيات لمدير النظام فقط." : "Permission management is restricted to administrators."}</div>;
  }

  const grant = async () => {
    if (!templateId || !userId) return;
    await grantPermission.mutateAsync({ templateId, userId });
    setUserId("");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">{lang === "ar" ? "صلاحيات النماذج" : "Form Access Grants"}</h2>
        <Badge variant="secondary">{grants.length}</Badge>
      </div>
      <p className="text-sm text-muted-foreground max-w-2xl">
        {lang === "ar"
          ? "امنح مستخدمًا محددًا صلاحية تعبئة نموذج محدد فقط (دون تعديل هيكله). المدراء وموظفو الموارد البشرية يستطيعون تعبئة كل النماذج بدون منح."
          : "Grant a specific user fill-only access to one specific form (never structure editing). Admins and HR-role staff can fill every form without grants."}
      </p>

      <div className="border border-border rounded-md p-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">{lang === "ar" ? "النموذج" : "Form"}</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue placeholder={lang === "ar" ? "اختر نموذجًا..." : "Pick a form..."} /></SelectTrigger>
            <SelectContent>
              {published.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.doc_no ? `${t.doc_no} — ` : ""}{t.title_en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{lang === "ar" ? "المستخدم" : "User"}</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder={lang === "ar" ? "اختر مستخدمًا..." : "Pick a user..."} /></SelectTrigger>
            <SelectContent>
              {(profiles as ProfileRow[]).map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.display_name || p.email || p.user_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={grant} disabled={!templateId || !userId || grantPermission.isPending}>
          <Plus className="h-4 w-4 me-1" />
          {lang === "ar" ? "منح الصلاحية" : "Grant Access"}
        </Button>
      </div>

      <div className="border border-border rounded-md divide-y divide-border">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</div>
        ) : grants.length === 0 ? (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">
            {lang === "ar" ? "لا توجد صلاحيات ممنوحة بعد." : "No grants yet."}
          </div>
        ) : (
          grants.map((g) => {
            const t = templateById.get(g.template_id);
            const p = profileByUserId.get(g.user_id);
            return (
              <div key={g.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p?.display_name || p?.email || g.user_id}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t ? `${t.doc_no ? `${t.doc_no} — ` : ""}${t.title_en}` : g.template_id}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground ms-auto shrink-0">{new Date(g.created_at).toLocaleDateString()}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive shrink-0"
                  onClick={() => revokePermission.mutate(g.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TemplatePermissionsPage;
