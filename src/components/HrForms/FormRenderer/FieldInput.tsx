// One input component per template field, switching on field.type.
// mode="edit" renders live inputs; mode="print" renders static values inside
// the same layout so the PDF/print capture matches what was filled.

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { formatFieldValue } from "@/lib/hrForms/templateEngine";
import type { HrField, HrFieldValue, HrTableRow, SignatureValue } from "@/lib/hrForms/types";

export type RenderMode = "edit" | "print";

interface Props {
  field: HrField;
  value: HrFieldValue;
  onChange: (value: HrFieldValue) => void;
  lang: "en" | "ar";
  mode: RenderMode;
  /** True when the value came from the employee record and the field locks it. */
  locked?: boolean;
}

const label = (f: { label_en: string; label_ar?: string }, lang: "en" | "ar") =>
  (lang === "ar" && f.label_ar) || f.label_en;

const PrintValue = ({ text }: { text: string }) => (
  <div className="min-h-[1.75rem] border-b border-dotted border-muted-foreground/50 text-sm font-medium flex items-end pb-0.5">
    {text || " "}
  </div>
);

const FieldInput = ({ field, value, onChange, lang, mode, locked }: Props) => {
  const disabled = mode === "print" || locked || field.source === "computed";

  if (mode === "print" && field.type !== "table") {
    return <PrintValue text={formatFieldValue(field, value, lang)} />;
  }

  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={lang === "ar" ? field.placeholder_ar : field.placeholder_en}
          rows={3}
        />
      );

    case "number":
    case "currency":
      return (
        <Input
          type="number"
          inputMode="decimal"
          value={value === null || value === undefined ? "" : String(value)}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          disabled={disabled}
          dir="ltr"
        />
      );

    case "date":
      return (
        <Input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          dir="ltr"
        />
      );

    case "select":
      return (
        <Select value={(value as string) ?? ""} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder={lang === "ar" ? "اختر..." : "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>{label(o, lang)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "radio":
      return (
        <RadioGroup
          value={(value as string) ?? ""}
          onValueChange={onChange}
          disabled={disabled}
          className="flex flex-wrap gap-x-5 gap-y-2 pt-1"
        >
          {(field.options ?? []).map((o) => (
            <div key={o.value} className="flex items-center gap-2">
              <RadioGroupItem value={o.value} id={`${field.key}-${o.value}`} />
              <Label htmlFor={`${field.key}-${o.value}`} className="font-normal cursor-pointer">
                {label(o, lang)}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );

    case "checkbox":
      return (
        <div className="pt-2">
          <Checkbox checked={!!value} onCheckedChange={(c) => onChange(!!c)} disabled={disabled} />
        </div>
      );

    case "signature": {
      const sig = (value as SignatureValue) ?? {};
      return (
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={sig.name ?? ""}
            onChange={(e) => onChange({ ...sig, name: e.target.value })}
            placeholder={lang === "ar" ? "الاسم" : "Name"}
            disabled={disabled}
          />
          <Input
            type="date"
            value={sig.date ?? ""}
            onChange={(e) => onChange({ ...sig, date: e.target.value })}
            disabled={disabled}
            dir="ltr"
          />
        </div>
      );
    }

    case "table": {
      const rows = (Array.isArray(value) ? value : []) as HrTableRow[];
      const columns = field.columns ?? [];
      const setRow = (idx: number, colKey: string, v: string | number | null) => {
        const next = rows.map((r, i) => (i === idx ? { ...r, [colKey]: v } : r));
        onChange(next);
      };
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border">
            <thead>
              <tr className="bg-muted/50">
                {columns.map((c) => (
                  <th key={c.key} className="border border-border px-2 py-1.5 text-start font-medium">
                    {label(c, lang)}
                  </th>
                ))}
                {mode === "edit" && <th className="border border-border w-10" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  {columns.map((c) => (
                    <td key={c.key} className="border border-border px-1 py-0.5">
                      {mode === "print" ? (
                        <span className="px-1">{row?.[c.key] ?? ""}</span>
                      ) : (
                        <Input
                          className="h-8 border-0 shadow-none focus-visible:ring-1"
                          type={c.type === "number" ? "number" : "text"}
                          dir={c.type === "number" ? "ltr" : undefined}
                          value={row?.[c.key] === null || row?.[c.key] === undefined ? "" : String(row[c.key])}
                          onChange={(e) =>
                            setRow(idx, c.key, c.type === "number"
                              ? (e.target.value === "" ? null : Number(e.target.value))
                              : e.target.value)
                          }
                        />
                      )}
                    </td>
                  ))}
                  {mode === "edit" && (
                    <td className="border border-border text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onChange(rows.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {mode === "edit" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => onChange([...rows, Object.fromEntries(columns.map((c) => [c.key, null]))])}
            >
              <Plus className="h-3.5 w-3.5 me-1" />
              {lang === "ar" ? "إضافة صف" : "Add row"}
            </Button>
          )}
        </div>
      );
    }

    case "computed":
      return (
        <div className="min-h-[2.25rem] rounded-md border border-dashed border-border bg-muted/30 px-3 flex items-center text-sm font-semibold">
          {formatFieldValue(field, value, lang) || "—"}
        </div>
      );

    case "text":
    default:
      return (
        <Input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={lang === "ar" ? field.placeholder_ar : field.placeholder_en}
        />
      );
  }
};

export default FieldInput;
