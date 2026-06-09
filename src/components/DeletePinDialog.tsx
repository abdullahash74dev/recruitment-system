import { useState, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PinRequest {
  message?: string;
  onConfirm: () => Promise<void> | void;
}

interface Ctx {
  requestDelete: (req: PinRequest) => void;
}

const DeletePinContext = createContext<Ctx | null>(null);

export const useDeletePin = () => {
  const ctx = useContext(DeletePinContext);
  if (!ctx) throw new Error("useDeletePin must be used within DeletePinProvider");
  return ctx;
};

export const DeletePinProvider = ({ children }: { children: ReactNode }) => {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [request, setRequest] = useState<PinRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const requestDelete = (req: PinRequest) => {
    setRequest(req);
    setPin("");
    setOpen(true);
  };

  const confirm = async () => {
    if (!pin) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-delete-pin", { body: { pin } });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data?.configured === false) {
        toast.error(lang === "ar" ? "لم يتم تعيين رقم سري للحذف. اطلب من المدير ضبطه من الإعدادات." : "No delete PIN set. Ask the admin to configure it in settings.");
        return;
      }
      if (!data?.valid) {
        toast.error(lang === "ar" ? "الرقم السري غير صحيح" : "Incorrect PIN");
        return;
      }
      await request?.onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DeletePinContext.Provider value={{ requestDelete }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" />
              {lang === "ar" ? "تأكيد الحذف بالرقم السري" : "Confirm deletion with PIN"}
            </DialogTitle>
            <DialogDescription>
              {request?.message || (lang === "ar"
                ? "أدخل الرقم السري لتأكيد عملية الحذف. هذه العملية لا يمكن التراجع عنها."
                : "Enter the PIN to confirm deletion. This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{lang === "ar" ? "الرقم السري" : "PIN"}</Label>
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirm(); }}
              placeholder="••••"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={busy || !pin} className="gap-2">
              <Trash2 className="w-4 h-4" />
              {busy ? "..." : (lang === "ar" ? "حذف نهائي" : "Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DeletePinContext.Provider>
  );
};
