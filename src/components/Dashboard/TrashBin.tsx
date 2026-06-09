import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, RotateCcw, Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useDeletePin } from "@/components/DeletePinDialog";

interface TrashRow {
  id: string;
  table_name: string;
  original_id: string;
  data: any;
  deleted_at: string;
  deleted_by_email: string | null;
  expires_at: string;
  restored: boolean;
}

const TrashBin = () => {
  const { lang } = useLanguage();
  const { requestDelete } = useDeletePin();
  const [rows, setRows] = useState<TrashRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TrashRow | null>(null);

  const fetchTrash = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("deleted_items")
      .select("*").order("deleted_at", { ascending: false }).limit(500);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows(data || []);
  };

  useEffect(() => { fetchTrash(); }, []);

  const restore = async (row: TrashRow) => {
    const { error } = await (supabase as any).rpc("restore_deleted_item", { _deleted_id: row.id });
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "ar" ? "تم استرجاع العنصر بنجاح" : "Item restored successfully");
    fetchTrash();
  };

  const purge = (row: TrashRow) => {
    requestDelete({
      message: lang === "ar" ? "حذف نهائي من السلة، لا يمكن التراجع." : "Permanently delete from trash. Cannot be undone.",
      onConfirm: async () => {
        const { error } = await (supabase as any).from("deleted_items").delete().eq("id", row.id);
        if (error) { toast.error(error.message); return; }
        toast.success(lang === "ar" ? "تم الحذف نهائياً" : "Permanently deleted");
        fetchTrash();
      },
    });
  };

  const daysLeft = (expires: string) => Math.max(0, Math.ceil((new Date(expires).getTime() - Date.now()) / 86400000));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Trash2 className="w-5 h-5" />{lang === "ar" ? "سلة المحذوفات" : "Deleted Items"}</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchTrash} disabled={loading} className="gap-1">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {lang === "ar" ? "تحديث" : "Refresh"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {lang === "ar"
            ? "العناصر المحذوفة تُحفظ لمدة 30 يوم، يمكن استرجاعها بنقرة أو حذفها نهائياً."
            : "Deleted items are kept for 30 days. Restore with one click or permanently purge."}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "ar" ? "الجدول" : "Table"}</TableHead>
                <TableHead>{lang === "ar" ? "حُذف بواسطة" : "Deleted by"}</TableHead>
                <TableHead>{lang === "ar" ? "تاريخ الحذف" : "Deleted at"}</TableHead>
                <TableHead>{lang === "ar" ? "ينتهي خلال" : "Expires in"}</TableHead>
                <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{lang === "ar" ? "السلة فارغة" : "Trash is empty"}</TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.table_name}</TableCell>
                  <TableCell className="text-sm">{r.deleted_by_email || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.deleted_at).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary">{daysLeft(r.expires_at)} {lang === "ar" ? "يوم" : "days"}</Badge></TableCell>
                  <TableCell>
                    {r.restored
                      ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{lang === "ar" ? "مُسترجع" : "Restored"}</Badge>
                      : <Badge variant="outline">{lang === "ar" ? "في السلة" : "In trash"}</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(r)}><Eye className="w-4 h-4" /></Button>
                      {!r.restored && (
                        <Button size="sm" variant="ghost" className="text-accent" onClick={() => restore(r)} title={lang === "ar" ? "استرجاع" : "Restore"}>
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => purge(r)} title={lang === "ar" ? "حذف نهائي" : "Purge"}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{lang === "ar" ? "محتوى العنصر المحذوف" : "Deleted Item Data"}</DialogTitle>
            </DialogHeader>
            {selected && (
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{JSON.stringify(selected.data, null, 2)}</pre>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default TrashBin;
