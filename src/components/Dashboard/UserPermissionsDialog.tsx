import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Save, RotateCcw, Search } from "lucide-react";
import {
  PERMISSION_GROUPS, PERMISSION_LABELS, getDefaultPermissions, type PermissionKey,
} from "@/hooks/useUserPermissions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userRole: string;
}

const UserPermissionsDialog = ({ open, onOpenChange, userId, userName, userRole }: Props) => {
  const { lang } = useLanguage();
  const [perms, setPerms] = useState<Record<string, boolean | null>>({});
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  const defaults = getDefaultPermissions(userRole);

  useEffect(() => { if (open) loadCustomPerms(); }, [open, userId]);

  const loadCustomPerms = async () => {
    const { data } = await supabase.from("user_permissions").select("permission_key, granted").eq("user_id", userId);
    const result: Record<string, boolean | null> = {};
    data?.forEach((p: any) => { result[p.permission_key] = p.granted; });
    setPerms(result);
  };

  const getEffective = (key: PermissionKey): boolean => {
    if (perms[key] !== null && perms[key] !== undefined) return perms[key]!;
    return defaults.includes(key);
  };
  const isCustomized = (key: PermissionKey) => perms[key] !== null && perms[key] !== undefined;
  const togglePerm = (key: PermissionKey) => setPerms(p => ({ ...p, [key]: !getEffective(key) }));
  const resetToDefault = (key: PermissionKey) => setPerms(p => { const n = { ...p }; delete n[key]; return n; });
  const resetAll = () => setPerms({});

  const toggleGroup = (keys: readonly string[], on: boolean) => {
    setPerms(p => { const n = { ...p }; keys.forEach(k => { n[k] = on; }); return n; });
  };

  const savePerms = async () => {
    setSaving(true);
    await supabase.from("user_permissions").delete().eq("user_id", userId);
    const inserts = Object.entries(perms)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k, v]) => ({ user_id: userId, permission_key: k, granted: v as boolean }));
    if (inserts.length > 0) {
      const { error } = await supabase.from("user_permissions").insert(inserts);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    toast.success(lang === "ar" ? "تم حفظ الصلاحيات" : "Permissions saved");
    setSaving(false);
    onOpenChange(false);
  };

  const matchesQuery = (key: string) => {
    if (!q.trim()) return true;
    const l = PERMISSION_LABELS[key];
    return (l?.ar + l?.en + key).toLowerCase().includes(q.toLowerCase());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {lang === "ar" ? `صلاحيات: ${userName}` : `Permissions: ${userName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge variant="outline">{lang === "ar" ? `الدور: ${userRole}` : `Role: ${userRole}`}</Badge>
          <Button variant="ghost" size="sm" onClick={resetAll} className="gap-1 text-xs">
            <RotateCcw className="w-3 h-3" />{lang === "ar" ? "إعادة الكل للافتراضي" : "Reset all"}
          </Button>
          <div className="relative ms-auto">
            <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder={lang === "ar" ? "بحث..." : "Search..."} className="h-8 ps-7 w-40" />
          </div>
        </div>

        <div className="space-y-5">
          {PERMISSION_GROUPS.map(group => {
            const items = group.items.filter(matchesQuery);
            if (items.length === 0) return null;
            return (
              <div key={group.key}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">{lang === "ar" ? group.ar : group.en}</h4>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => toggleGroup(group.items, true)}>
                      {lang === "ar" ? "تفعيل الكل" : "All on"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => toggleGroup(group.items, false)}>
                      {lang === "ar" ? "تعطيل الكل" : "All off"}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map(key => {
                    const effective = getEffective(key);
                    const custom = isCustomized(key);
                    return (
                      <div key={key} className="flex items-center gap-2 rounded-md border p-2">
                        <Checkbox checked={effective} onCheckedChange={() => togglePerm(key)} />
                        <Label className="text-xs cursor-pointer flex-1 truncate" onClick={() => togglePerm(key)}>
                          {lang === "ar" ? PERMISSION_LABELS[key]?.ar : PERMISSION_LABELS[key]?.en}
                        </Label>
                        {custom && (
                          <button onClick={() => resetToDefault(key)} className="text-[10px] text-muted-foreground hover:text-foreground">
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={savePerms} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "..." : (lang === "ar" ? "حفظ الصلاحيات" : "Save Permissions")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserPermissionsDialog;
