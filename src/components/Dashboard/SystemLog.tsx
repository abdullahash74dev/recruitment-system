import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollText, Search, RefreshCw, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface AuditRow {
  id: string;
  occurred_at: string;
  user_email: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  summary: string | null;
  old_data: any;
  new_data: any;
  ip_address: string | null;
  user_agent: string | null;
}

const ACTION_COLOR: Record<string, string> = {
  INSERT: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  UPDATE: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  DELETE: "bg-destructive/15 text-destructive",
  LOGIN: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  LOGOUT: "bg-muted text-muted-foreground",
  LOGIN_FAILED: "bg-destructive/20 text-destructive",
  RESTORE: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  CUSTOM: "bg-secondary text-secondary-foreground",
  EXPORT: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  IMPORT: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
};

const SystemLog = () => {
  const { lang } = useLanguage();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const fetchLog = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("audit_log")
      .select("*").order("occurred_at", { ascending: false }).limit(500);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows(data || []);
  };

  useEffect(() => { fetchLog(); }, []);

  const filtered = rows.filter(r => {
    if (actionFilter !== "all" && r.action !== actionFilter) return false;
    if (tableFilter !== "all" && r.table_name !== tableFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${r.user_email || ""} ${r.summary || ""} ${r.table_name || ""} ${r.record_id || ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const tables = Array.from(new Set(rows.map(r => r.table_name).filter(Boolean))) as string[];
  const actions = Array.from(new Set(rows.map(r => r.action)));

  const exportExcel = () => {
    if (filtered.length === 0) { toast.error(lang === "ar" ? "لا توجد بيانات" : "No data"); return; }
    const data = filtered.map(r => ({
      [lang === "ar" ? "التاريخ" : "Date"]: new Date(r.occurred_at).toLocaleString(),
      [lang === "ar" ? "المستخدم" : "User"]: r.user_email || "—",
      [lang === "ar" ? "العملية" : "Action"]: r.action,
      [lang === "ar" ? "الجدول" : "Table"]: r.table_name || "—",
      [lang === "ar" ? "الوصف" : "Summary"]: r.summary || "",
      [lang === "ar" ? "معرّف السجل" : "Record ID"]: r.record_id || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AuditLog");
    XLSX.writeFile(wb, `audit_log_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2"><ScrollText className="w-5 h-5" />{lang === "ar" ? "سجل النظام" : "System Log"}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLog} disabled={loading} className="gap-1">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {lang === "ar" ? "تحديث" : "Refresh"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1">
              <Download className="w-4 h-4" />
              {lang === "ar" ? "تصدير Excel" : "Export Excel"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute start-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="ps-8" placeholder={lang === "ar" ? "بحث..." : "Search..."} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "كل العمليات" : "All actions"}</SelectItem>
              {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "كل الجداول" : "All tables"}</SelectItem>
              {tables.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground">
          {lang === "ar" ? `إجمالي السجلات: ${filtered.length} / ${rows.length}` : `Total: ${filtered.length} / ${rows.length}`}
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "ar" ? "التاريخ" : "Date"}</TableHead>
                <TableHead>{lang === "ar" ? "المستخدم" : "User"}</TableHead>
                <TableHead>{lang === "ar" ? "العملية" : "Action"}</TableHead>
                <TableHead>{lang === "ar" ? "الجدول" : "Table"}</TableHead>
                <TableHead>{lang === "ar" ? "الوصف" : "Summary"}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{lang === "ar" ? "لا توجد سجلات" : "No records"}</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.occurred_at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{r.user_email || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><Badge className={ACTION_COLOR[r.action] || ""} variant="secondary">{r.action}</Badge></TableCell>
                  <TableCell className="text-xs">{r.table_name || "—"}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{r.summary}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(r)}><Eye className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{lang === "ar" ? "تفاصيل السجل" : "Log Details"}</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><b>{lang === "ar" ? "التاريخ" : "Date"}:</b> {new Date(selected.occurred_at).toLocaleString()}</div>
                  <div><b>{lang === "ar" ? "العملية" : "Action"}:</b> {selected.action}</div>
                  <div><b>{lang === "ar" ? "المستخدم" : "User"}:</b> {selected.user_email || "—"}</div>
                  <div><b>{lang === "ar" ? "الجدول" : "Table"}:</b> {selected.table_name || "—"}</div>
                  <div className="col-span-2"><b>{lang === "ar" ? "معرّف السجل" : "Record ID"}:</b> <span className="font-mono text-xs">{selected.record_id || "—"}</span></div>
                  <div className="col-span-2 text-xs text-muted-foreground"><b>UA:</b> {selected.user_agent || "—"}</div>
                </div>
                {selected.old_data && (
                  <div>
                    <div className="font-bold mb-1">{lang === "ar" ? "البيانات قبل" : "Old data"}:</div>
                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-h-64">{JSON.stringify(selected.old_data, null, 2)}</pre>
                  </div>
                )}
                {selected.new_data && (
                  <div>
                    <div className="font-bold mb-1">{lang === "ar" ? "البيانات بعد" : "New data"}:</div>
                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-h-64">{JSON.stringify(selected.new_data, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default SystemLog;
