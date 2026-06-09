import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Upload, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const OUT_COLS = [
  "project_code","job_title_ar","candidate_name","nationality","phone","email",
  "status","rejected_reason","interview_date","hire_date",
  "offer_sent_date","offer_signed_date","expected_start_date","actual_start_date",
  "batch_label","cv_url","notes",
];

interface Props {
  ar: boolean;
  onImported: () => void;
}

export default function AiImportRecruitment({ ar, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [filename, setFilename] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setAnalyzing(true);
    setPreview(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
      if (json.length < 2) throw new Error(ar ? "الملف فارغ" : "Empty file");
      const headers = (json[0] as any[]).map((h: any) => String(h ?? "").trim());
      const rows = (json.slice(1) as any[][]).filter(r => r.some(v => v !== "" && v != null));
      if (rows.length === 0) throw new Error(ar ? "لا توجد صفوف" : "No rows");
      if (rows.length > 300) throw new Error(ar ? `الحد الأقصى 300 صف لكل دفعة (لديك ${rows.length})` : `Max 300 rows per batch (you have ${rows.length})`);

      toast.info(ar ? `تحليل ${rows.length} صف بالذكاء الاصطناعي...` : `Analyzing ${rows.length} rows with AI...`);
      const { data, error } = await supabase.functions.invoke("ai-import-recruitment", {
        body: { headers, rows, filename: file.name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPreview(data);
      const valid = (data.rows || []).filter((r: any) => r.project_code && r.job_title_ar && r.candidate_name);
      setSelected(new Set(valid.map((r: any) => r._row)));
      setOpen(true);
      toast.success(ar ? "تم التحليل — راجع البيانات قبل التأكيد" : "Analyzed — review before commit");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggle = (row: number) => {
    setSelected(s => {
      const n = new Set(s);
      n.has(row) ? n.delete(row) : n.add(row);
      return n;
    });
  };

  const commit = async () => {
    if (!preview) return;
    const toSend = (preview.rows || []).filter((r: any) => selected.has(r._row));
    if (toSend.length === 0) { toast.warning(ar ? "لم يتم اختيار أي صف" : "No rows selected"); return; }
    setCommitting(true);
    try {
      const rowsArr = toSend.map((r: any) => OUT_COLS.map(k => r[k] ?? ""));
      const { data, error } = await supabase.functions.invoke("import-recruitment", {
        body: {
          sheets: { Candidates: { headers: OUT_COLS, rows: rowsArr } },
          filename: `AI_${filename}`,
          strict_existing: true,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const ins = data.candidates?.inserted || 0;
      const fail = data.candidates?.failed || 0;
      if (ins > 0) toast.success(ar ? `تم استيراد ${ins} مرشح` : `Imported ${ins} candidates`);
      if (fail > 0) toast.warning(ar ? `${fail} مرفوض — راجع التفاصيل` : `${fail} rejected`);
      if (fail === 0) { setOpen(false); setPreview(null); }
      onImported();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCommitting(false);
    }
  };

  const stats = preview ? {
    total: preview.rows.length,
    valid: preview.rows.filter((r: any) => r.project_code && r.job_title_ar && r.candidate_name).length,
    warnings: preview.rows.filter((r: any) => r._warnings?.length).length,
  } : null;

  return (
    <>
      <Button onClick={() => fileRef.current?.click()} disabled={analyzing} variant="default" className="gap-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90">
        {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {analyzing ? (ar ? "جاري التحليل..." : "Analyzing...") : (ar ? "استيراد ذكي بالذكاء الاصطناعي" : "AI Smart Import")}
      </Button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />{ar ? "معاينة الاستيراد الذكي" : "AI Import Preview"}</DialogTitle>
            <DialogDescription>
              {ar
                ? "راجع المرشحين المُطابقين بالذكاء الاصطناعي مع المشاريع والوظائف الموجودة. اختر الصفوف التي تريد إضافتها رسمياً."
                : "Review AI-matched candidates against existing projects/jobs. Select rows to commit officially."}
            </DialogDescription>
          </DialogHeader>

          {preview && stats && (
            <>
              <div className="flex flex-wrap gap-3 text-sm rounded-lg border bg-muted/30 p-3">
                <span className="flex items-center gap-1"><FileSpreadsheet className="w-4 h-4" />{filename}</span>
                <span>{ar ? "الإجمالي" : "Total"}: <b>{stats.total}</b></span>
                <span className="text-emerald-600">{ar ? "صالح" : "Valid"}: <b>{stats.valid}</b></span>
                <span className="text-amber-600">{ar ? "تحذيرات" : "Warnings"}: <b>{stats.warnings}</b></span>
                <span className="text-primary ms-auto">{ar ? "محدد للاستيراد" : "Selected"}: <b>{selected.size}</b></span>
              </div>

              {preview.summary && (
                <div className="rounded border-primary/20 border bg-primary/5 p-2 text-xs">
                  <span className="font-semibold flex items-center gap-1"><Sparkles className="w-3 h-3" />AI: </span>{preview.summary}
                </div>
              )}

              <div className="flex-1 overflow-auto border rounded">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-10">
                        <input type="checkbox"
                          checked={selected.size === preview.rows.length && preview.rows.length > 0}
                          onChange={e => setSelected(e.target.checked ? new Set(preview.rows.map((r: any) => r._row)) : new Set())} />
                      </TableHead>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>{ar ? "الاسم" : "Name"}</TableHead>
                      <TableHead>{ar ? "المشروع" : "Project"}</TableHead>
                      <TableHead>{ar ? "الوظيفة" : "Job"}</TableHead>
                      <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                      <TableHead>{ar ? "الجوال" : "Phone"}</TableHead>
                      <TableHead>{ar ? "البريد" : "Email"}</TableHead>
                      <TableHead>{ar ? "ملاحظات AI" : "AI Notes"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((r: any) => {
                      const invalid = !r.project_code || !r.job_title_ar || !r.candidate_name;
                      return (
                        <TableRow key={r._row} className={invalid ? "bg-destructive/5" : ""}>
                          <TableCell><input type="checkbox" checked={selected.has(r._row)} onChange={() => toggle(r._row)} disabled={invalid} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r._row}</TableCell>
                          <TableCell className="font-medium">{r.candidate_name || <span className="text-destructive text-xs">{ar?"مفقود":"missing"}</span>}</TableCell>
                          <TableCell>{r.project_code || <Badge variant="destructive" className="text-xs">{ar?"غير مطابق":"no match"}</Badge>}</TableCell>
                          <TableCell>{r.job_title_ar || <Badge variant="destructive" className="text-xs">{ar?"غير مطابق":"no match"}</Badge>}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{r.status}</Badge></TableCell>
                          <TableCell className="text-xs" dir="ltr">{r.phone}</TableCell>
                          <TableCell className="text-xs" dir="ltr">{r.email}</TableCell>
                          <TableCell className="text-xs">
                            {r._warnings?.length > 0 && (
                              <div className="flex items-start gap-1 text-amber-600">
                                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                <span>{r._warnings.join(" • ")}</span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={committing}>{ar?"إلغاء":"Cancel"}</Button>
            <Button onClick={commit} disabled={committing || selected.size === 0} className="gap-1">
              {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {ar ? `تأكيد وإضافة ${selected.size}` : `Commit ${selected.size} rows`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
