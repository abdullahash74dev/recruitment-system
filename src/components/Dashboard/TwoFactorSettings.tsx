import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { fetchSiteSettings, invalidateSiteSettingsCache } from "@/hooks/useSiteSettings";
import { logAudit } from "@/lib/audit";

const TwoFactorSettings = () => {
  const { lang } = useLanguage();
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSiteSettings().then((s) => {
      setSettingsId(s.id);
      setEnabled(!!s.two_factor_enabled);
      setLoading(false);
    });
  }, []);

  const toggle = async (checked: boolean) => {
    if (!settingsId) return;
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({ two_factor_enabled: checked })
      .eq("id", settingsId);
    setSaving(false);
    if (error) {
      toast.error(lang === "ar" ? "فشل تحديث الإعداد. تحقق من صلاحياتك." : "Failed to update setting. Check your permissions.");
      return;
    }
    setEnabled(checked);
    invalidateSiteSettingsCache();
    logAudit({
      action: "CUSTOM",
      summary: checked ? "Enabled email 2FA for admin login" : "Disabled email 2FA for admin login",
    });
    toast.success(lang === "ar" ? "تم حفظ الإعداد" : "Setting saved");
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-accent" />
          {lang === "ar" ? "التحقق بخطوتين عبر البريد الإلكتروني" : "Email Two-Factor Authentication"}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ar"
            ? "عند التفعيل، سيُطلب من المستخدمين إدخال كود تحقق يُرسل إلى بريدهم الإلكتروني المسجل بعد تسجيل الدخول بكلمة المرور."
            : "When enabled, users must enter a verification code sent to their registered email after signing in with their password."}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={enabled} onCheckedChange={toggle} disabled={saving} />
        <Label>{enabled ? (lang === "ar" ? "مفعّل" : "Enabled") : (lang === "ar" ? "غير مفعّل" : "Disabled")}</Label>
      </div>

      <p className="text-xs text-muted-foreground">
        {lang === "ar"
          ? "ملاحظة: يتم إرسال الكود عبر خدمة البريد الافتراضية في Supabase وقد تكون محدودة العدد. ينصح بتجربة تسجيل الخروج والدخول مرة للتأكد من استلام الكود قبل الاعتماد عليه. في حال عدم استلام أي كود يمكن تعطيل هذا الإعداد مباشرة من جدول site_settings عبر لوحة Supabase."
          : "Note: codes are sent via Supabase's default email service, which has a limited sending quota. Log out and back in once to confirm delivery before relying on it. If a code never arrives, this can be disabled directly from the site_settings table in the Supabase dashboard."}
      </p>
    </div>
  );
};

export default TwoFactorSettings;
