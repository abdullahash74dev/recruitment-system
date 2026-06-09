import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import type { EditableOption } from "./SortableItem";

interface ExcelImportExportProps {
  fieldLabel: string;
  items: EditableOption[];
  lang: string;
  onImport: (items: EditableOption[]) => void;
}

const ExcelImportExport = ({ fieldLabel, items, lang, onImport }: ExcelImportExportProps) => {
  const downloadTemplate = () => {
    const data = items.length > 0
      ? items.map((item, i) => ({ "#": i + 1, "Arabic (عربي)": item.ar, "English (إنجليزي)": item.en, "Enabled (مفعّل)": item.enabled ? "Yes" : "No" }))
      : [{ "#": 1, "Arabic (عربي)": "", "English (إنجليزي)": "", "Enabled (مفعّل)": "Yes" }];

    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 30 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, fieldLabel);
    XLSX.writeFile(wb, `${fieldLabel}.xlsx`);
    toast.success(lang === "ar" ? "تم تحميل القالب" : "Template downloaded");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);
        if (rows.length === 0) { toast.error(lang === "ar" ? "الملف فارغ" : "File is empty"); return; }

        const imported: EditableOption[] = rows
          .filter((r) => r["Arabic (عربي)"] || r["English (إنجليزي)"])
          .map((r) => ({
            id: crypto.randomUUID(),
            ar: String(r["Arabic (عربي)"] || "").trim(),
            en: String(r["English (إنجليزي)"] || "").trim(),
            enabled: String(r["Enabled (مفعّل)"] || "Yes").toLowerCase() !== "no",
          }));

        if (imported.length === 0) { toast.error(lang === "ar" ? "لا توجد بيانات صالحة" : "No valid data found"); return; }
        onImport(imported);
        toast.success(lang === "ar" ? `تم استيراد ${imported.length} خيار` : `Imported ${imported.length} options`);
      } catch {
        toast.error(lang === "ar" ? "خطأ في قراءة الملف" : "Error reading file");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1">
        <Download className="w-3.5 h-3.5" />
        {lang === "ar" ? "تحميل قالب Excel" : "Download Template"}
      </Button>
      <Button variant="outline" size="sm" className="gap-1 relative" asChild>
        <label>
          <Upload className="w-3.5 h-3.5" />
          {lang === "ar" ? "استيراد من Excel" : "Import from Excel"}
          <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="sr-only" />
        </label>
      </Button>
    </div>
  );
};

export default ExcelImportExport;
