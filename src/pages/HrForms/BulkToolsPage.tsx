// Admin Excel bulk tools:
//  1. Employee master import (download template, upload to upsert by employee_no)
//  2. Bulk fill one form for many employees from one sheet (creates drafts)
//  3. Aggregate data-collection workbook across several forms — send to
//     another department, get it back, and fan the answers out into drafts
//     for every selected form per employee.

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { latestTemplates, useEmployeesQuery, useHrFormTemplatesQuery } from "@/hooks/queries/useHrForms";
import {
  aggregateFields,
  bulkFillFields,
  downloadAggregateTemplate,
  downloadBulkFillTemplate,
  downloadEmployeeTemplate,
  parseBulkFillFile,
  parseEmployeesFile,
} from "@/lib/hrForms/bulkExcel";
import { logAudit } from "@/lib/audit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const BulkToolsPage = () => {
  const { lang } = useLanguage();
  const { role } = useUserPermissions();
  const queryClient = useQueryClient();
  const { data: templates = [] } = useHrFormTemplatesQuery();
  const { data: employees = [] } = useEmployeesQuery();

  const published = useMemo(() => latestTemplates(templates.filter((t) => t.status === "published")), [templates]);
  const employeeByNo = useMemo(
    () => new Map(employees.filter((e) => e.employee_no).map((e) => [e.employee_no as string, e])),
    [employees],
  );

  const [bulkTemplateId, setBulkTemplateId] = useState("");
  const [aggregateIds, setAggregateIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const employeeFileRef = useRef<HTMLInputElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const aggregateFileRef = useRef<HTMLInputElement>(null);

  if (role !== "admin") {
    return <div className="text-center py-12 text-muted-foreground">{lang === "ar" ? "أدوات الاستيراد الجماعي لمدير النظام فقط." : "Bulk tools are restricted to administrators."}</div>;
  }

  const bulkTemplate = published.find((t) => t.id === bulkTemplateId) ?? null;
  const aggregateTemplates = published.filter((t) => aggregateIds.has(t.id));

  // -- 1) Employee import ----------------------------------------------------
  const importEmployees = async (file: File) => {
    setBusy(true);
    try {
      const rows = await parseEmployeesFile(file);
      if (rows.length === 0) {
        toast.error(lang === "ar" ? "لم يتم العثور على صفوف صالحة (عمود full_name_en إلزامي)." : "No valid rows found (full_name_en column is required).");
        return;
      }
      const withNo = rows.filter((r) => r.employee_no);
      const withoutNo = rows.filter((r) => !r.employee_no);
      if (withNo.length > 0) {
        const { error } = await db.from("employees").upsert(withNo, { onConflict: "employee_no" });
        if (error) throw error;
      }
      if (withoutNo.length > 0) {
        const { error } = await db.from("employees").insert(withoutNo);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
      logAudit({ action: "IMPORT", summary: `Employee master import: ${rows.length} rows`, table_name: "employees" });
      toast.success(lang === "ar" ? `تم استيراد ${rows.length} موظفًا` : `Imported ${rows.length} employees`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  // -- 2) Bulk fill one template --------------------------------------------
  const importBulkFill = async (file: File) => {
    if (!bulkTemplate) return;
    setBusy(true);
    try {
      const fields = bulkFillFields(bulkTemplate);
      const rows = await parseBulkFillFile(file, fields);
      if (rows.length === 0) {
        toast.error(lang === "ar" ? "لا توجد صفوف صالحة في الملف." : "No valid rows in the file.");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const unmatched: string[] = [];
      const inserts = rows.map((r) => {
        const emp = r.employee_no ? employeeByNo.get(r.employee_no) : null;
        if (r.employee_no && !emp) unmatched.push(r.employee_no);
        return {
          template_id: bulkTemplate.id,
          employee_id: emp?.id ?? null,
          data: r.data,
          requested_by: user.id,
          requested_by_email: user.email,
        };
      });
      const { error } = await db.from("hr_form_submissions").insert(inserts);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.hrFormSubmissions.all });
      logAudit({ action: "IMPORT", summary: `Bulk fill: ${inserts.length} drafts of ${bulkTemplate.title_en}`, table_name: "hr_form_submissions" });
      toast.success(
        lang === "ar"
          ? `تم إنشاء ${inserts.length} مسودة${unmatched.length ? ` (أرقام وظيفية غير معروفة: ${unmatched.join("، ")})` : ""}`
          : `Created ${inserts.length} drafts${unmatched.length ? ` (unknown employee numbers: ${unmatched.join(", ")})` : ""}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk fill failed");
    } finally {
      setBusy(false);
    }
  };

  // -- 3) Aggregate collection ------------------------------------------------
  const importAggregate = async (file: File) => {
    if (aggregateTemplates.length === 0) return;
    setBusy(true);
    try {
      const fields = aggregateFields(aggregateTemplates);
      const rows = await parseBulkFillFile(file, fields);
      if (rows.length === 0) {
        toast.error(lang === "ar" ? "لا توجد صفوف صالحة في الملف." : "No valid rows in the file.");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // Fan each row out: one draft per selected template, carrying only the
      // fields that template actually contains.
      const inserts: Record<string, unknown>[] = [];
      const unmatched: string[] = [];
      for (const row of rows) {
        const emp = row.employee_no ? employeeByNo.get(row.employee_no) : null;
        if (row.employee_no && !emp) unmatched.push(row.employee_no);
        for (const t of aggregateTemplates) {
          const keys = new Set(bulkFillFields(t).map((f) => f.key));
          const data = Object.fromEntries(Object.entries(row.data).filter(([k]) => keys.has(k)));
          inserts.push({
            template_id: t.id,
            employee_id: emp?.id ?? null,
            data,
            requested_by: user.id,
            requested_by_email: user.email,
          });
        }
      }
      const { error } = await db.from("hr_form_submissions").insert(inserts);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.hrFormSubmissions.all });
      logAudit({ action: "IMPORT", summary: `Aggregate import: ${inserts.length} drafts across ${aggregateTemplates.length} forms`, table_name: "hr_form_submissions" });
      toast.success(
        lang === "ar"
          ? `تم إنشاء ${inserts.length} مسودة عبر ${aggregateTemplates.length} نموذجًا${unmatched.length ? ` (أرقام غير معروفة: ${unmatched.join("، ")})` : ""}`
          : `Created ${inserts.length} drafts across ${aggregateTemplates.length} forms${unmatched.length ? ` (unknown numbers: ${unmatched.join(", ")})` : ""}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aggregate import failed");
    } finally {
      setBusy(false);
    }
  };

  const fileInput = (ref: React.RefObject<HTMLInputElement>, onFile: (f: File) => void) => (
    <input
      ref={ref}
      type="file"
      accept=".xlsx,.xls"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onFile(f);
        e.target.value = "";
      }}
    />
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">{lang === "ar" ? "أدوات الإكسل الجماعية" : "Excel Bulk Tools"}</h2>
      </div>

      {/* 1) Employees */}
      <section className="border border-border rounded-md p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4" />
          {lang === "ar" ? "استيراد بيانات الموظفين" : "Employee Master Import"}
        </div>
        <p className="text-sm text-muted-foreground">
          {lang === "ar"
            ? "حمّل القالب، عبّئه، ثم ارفعه — الصفوف التي تحمل رقمًا وظيفيًا موجودًا تُحدَّث، والجديدة تُضاف."
            : "Download the template, fill it, upload it back — rows with an existing employee number are updated, new ones are added."}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={downloadEmployeeTemplate}>
            <Download className="h-4 w-4 me-2" />
            {lang === "ar" ? "تحميل القالب" : "Download Template"}
          </Button>
          <Button onClick={() => employeeFileRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4 me-2" />
            {lang === "ar" ? "رفع الملف" : "Upload File"}
          </Button>
          {fileInput(employeeFileRef, importEmployees)}
        </div>
      </section>

      {/* 2) Bulk fill */}
      <section className="border border-border rounded-md p-4 space-y-3">
        <div className="font-semibold">{lang === "ar" ? "تعبئة نموذج واحد لعدة موظفين" : "Bulk Fill One Form"}</div>
        <p className="text-sm text-muted-foreground">
          {lang === "ar"
            ? "اختر نموذجًا، حمّل ورقة التعبئة (صف لكل موظف)، ثم ارفعها لإنشاء مسودة لكل صف — تفتح كل مسودة للمراجعة والتقديم كالمعتاد."
            : "Pick a form, download its fill sheet (one row per employee), upload it back to create a draft per row — each draft then goes through the normal review/submit flow."}
        </p>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1 w-full sm:w-80">
            <Label className="text-xs">{lang === "ar" ? "النموذج" : "Form"}</Label>
            <Select value={bulkTemplateId} onValueChange={setBulkTemplateId}>
              <SelectTrigger><SelectValue placeholder={lang === "ar" ? "اختر نموذجًا..." : "Pick a form..."} /></SelectTrigger>
              <SelectContent>
                {published.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.doc_no ? `${t.doc_no} — ` : ""}{t.title_en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" disabled={!bulkTemplate} onClick={() => bulkTemplate && downloadBulkFillTemplate(bulkTemplate)}>
            <Download className="h-4 w-4 me-2" />
            {lang === "ar" ? "ورقة التعبئة" : "Fill Sheet"}
          </Button>
          <Button disabled={!bulkTemplate || busy} onClick={() => bulkFileRef.current?.click()}>
            <Upload className="h-4 w-4 me-2" />
            {lang === "ar" ? "رفع وإنشاء المسودات" : "Upload & Create Drafts"}
          </Button>
          {fileInput(bulkFileRef, importBulkFill)}
        </div>
      </section>

      {/* 3) Aggregate */}
      <section className="border border-border rounded-md p-4 space-y-3">
        <div className="font-semibold">{lang === "ar" ? "تجميع بيانات عدة نماذج في ملف واحد" : "Aggregate Data Collection Across Forms"}</div>
        <p className="text-sm text-muted-foreground">
          {lang === "ar"
            ? "اختر عدة نماذج فيُجمع اتحاد حقولها في ورقة واحدة (عمود لكل حقل مشترك مرة واحدة). أرسلها للقسم المزوِّد بالبيانات، ثم ارفعها لتتوزع الإجابات تلقائيًا كمسودات لكل نموذج مختار لكل موظف."
            : "Pick several forms; the union of their fields becomes one sheet (shared fields appear once). Hand it to the providing department, then upload the returned file — answers fan out automatically into drafts of every selected form per employee."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {published.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm border border-border rounded px-2 py-1.5 cursor-pointer hover:bg-muted/40">
              <Checkbox
                checked={aggregateIds.has(t.id)}
                onCheckedChange={(c) => {
                  setAggregateIds((prev) => {
                    const next = new Set(prev);
                    if (c) next.add(t.id); else next.delete(t.id);
                    return next;
                  });
                }}
              />
              <span className="truncate">{t.doc_no ? `${t.doc_no} — ` : ""}{t.title_en}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{aggregateTemplates.length} {lang === "ar" ? "نموذج مختار" : "selected"}</Badge>
          <Button variant="outline" disabled={aggregateTemplates.length === 0} onClick={() => downloadAggregateTemplate(aggregateTemplates)}>
            <Download className="h-4 w-4 me-2" />
            {lang === "ar" ? "ورقة التجميع" : "Collection Sheet"}
          </Button>
          <Button disabled={aggregateTemplates.length === 0 || busy} onClick={() => aggregateFileRef.current?.click()}>
            <Upload className="h-4 w-4 me-2" />
            {lang === "ar" ? "رفع وتوزيع البيانات" : "Upload & Distribute"}
          </Button>
          {fileInput(aggregateFileRef, importAggregate)}
        </div>
      </section>
    </div>
  );
};

export default BulkToolsPage;
