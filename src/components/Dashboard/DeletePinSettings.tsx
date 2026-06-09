import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldAlert, Save, Eye, EyeOff } from "lucide-react";

const DeletePinSettings = () => {
  const { lang } = useLanguage();
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [show, setShow] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.functions.invoke("verify-delete-pin", { body: { checkOnly: true } }).then(({ data }) => {
      setHasPin(!!(data as any)?.configured);
    });
  }, []);

  const save = async () => {
    if (!/^\d{6,8}$/.test(pin)) {
      toast.error(lang === "ar" ? "الرقم السري يجب أن يكون من 6 إلى 8 أرقام" : "PIN must be 6-8 digits");
      return;
    }
    if (pin !== confirmPin) {
      toast.error(lang === "ar" ? "الأرقام غير متطابقة" : "PINs do not match");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("verify-delete-pin", { body: { setPin: pin } });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed");
      return;
    }
    toast.success(lang === "ar" ? "تم حفظ الرقم السري" : "PIN saved");
    setHasPin(true);
    setPin(""); setConfirmPin("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-destructive" />
          {lang === "ar" ? "الرقم السري لعمليات الحذف" : "Deletion PIN"}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ar"
            ? "هذا الرقم سيُطلب قبل أي عملية حذف نهائي بالنظام (وظائف، مرشحين، مشاريع، مستخدمين، أسئلة...)."
            : "This PIN will be required before any permanent deletion (jobs, applicants, projects, users, questions...)."}
        </p>
        <p className="text-xs mt-1">
          {hasPin
            ? <span className="text-accent font-semibold">{lang === "ar" ? "✓ تم تعيين رقم سري" : "✓ PIN is configured"}</span>
            : <span className="text-destructive font-semibold">{lang === "ar" ? "⚠ لم يتم تعيين رقم سري بعد" : "⚠ No PIN set yet"}</span>}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
        <div className="space-y-2">
          <Label>{lang === "ar" ? "الرقم السري الجديد" : "New PIN"}</Label>
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{lang === "ar" ? "تأكيد الرقم السري" : "Confirm PIN"}</Label>
          <Input
            type={show ? "text" : "password"}
            inputMode="numeric"
            maxLength={8}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
          />
        </div>
      </div>

      <Button onClick={save} disabled={saving || !pin || !confirmPin} className="gap-2">
        <Save className="w-4 h-4" />
        {saving ? "..." : (lang === "ar" ? "حفظ الرقم السري" : "Save PIN")}
      </Button>
    </div>
  );
};

export default DeletePinSettings;
