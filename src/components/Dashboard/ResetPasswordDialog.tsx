import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Eye, EyeOff } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  onSubmit: (newPassword: string) => Promise<{ error?: string } | void>;
}

const ResetPasswordDialog = ({ open, onOpenChange, userName, onSubmit }: Props) => {
  const { t, lang } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setPassword("");
    setConfirm("");
    setShow(false);
    setError("");
    setSaving(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (password.length < 6) { setError(t("admin.passwordTooShort")); return; }
    if (password !== confirm) { setError(t("admin.passwordMismatch")); return; }
    setError("");
    setSaving(true);
    const result = await onSubmit(password);
    setSaving(false);
    if (result && "error" in result && result.error) { setError(result.error); return; }
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            {t("dash.resetPasswordFor")} {userName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{t("dash.resetPasswordDesc")}</p>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{t("admin.newPasswordLabel")}</Label>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pe-10"
              />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("admin.confirmPassword")}</Label>
            <Input
              type={show ? "text" : "password"}
              dir="ltr"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>{t("dash.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gradient-accent text-accent-foreground gap-2">
            <KeyRound className="w-4 h-4" />
            {saving ? "..." : t("dash.resetPassword")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResetPasswordDialog;
