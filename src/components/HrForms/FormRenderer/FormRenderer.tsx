// Schema-driven form renderer: doc-control header + sections + fields.
// The exact same component tree renders the interactive fill screen
// (mode="edit") and the print/PDF capture node (mode="print"), which is what
// keeps on-screen, PDF and image output identical.

import DocControlHeader from "./DocControlHeader";
import FieldInput, { type RenderMode } from "./FieldInput";
import type { ResolvedForm } from "@/lib/hrForms/templateEngine";
import { employeeFieldValue } from "@/lib/hrForms/templateEngine";
import type { HrField, HrFieldValue } from "@/lib/hrForms/types";

interface Props {
  resolved: ResolvedForm;
  lang: "en" | "ar";
  mode: RenderMode;
  onFieldChange?: (key: string, value: HrFieldValue) => void;
  /** Footer line (e.g. custom copyright) shown under the form body. */
  footerText?: string;
}

const fieldSpan = (field: HrField): string => {
  if (field.type === "table" || field.type === "textarea") return "sm:col-span-2";
  if (field.type === "radio" && (field.options?.length ?? 0) > 3) return "sm:col-span-2";
  return "";
};

const FormRenderer = ({ resolved, lang, mode, onFieldChange, footerText }: Props) => {
  const { template, employee, values } = resolved;

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="bg-background text-foreground">
      <DocControlHeader resolved={resolved} lang={lang} />

      <div className="border-x border-b border-border rounded-b-md">
        {(template.schema.sections ?? []).map((section) => (
          <div key={section.key} className="border-b border-border last:border-b-0">
            <div className="bg-muted/60 px-4 py-2 font-semibold text-sm">
              {(lang === "ar" && section.title_ar) || section.title_en}
            </div>
            {(section.note_en || section.note_ar) && (
              <p className="px-4 pt-2 text-xs text-muted-foreground italic">
                {lang === "ar" ? section.note_ar || section.note_en : section.note_en}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 p-4">
              {(section.fields ?? []).map((field) => {
                const prefilled =
                  field.source === "employee" &&
                  employee !== null &&
                  employeeFieldValue(employee, field.employee_field) !== null;
                return (
                  <div key={field.key} className={`space-y-1 ${fieldSpan(field)}`}>
                    <div className="text-xs font-medium text-muted-foreground flex items-baseline justify-between gap-2">
                      <span>
                        {field.label_en}
                        {field.required && mode === "edit" && <span className="text-destructive ms-0.5">*</span>}
                      </span>
                      {field.label_ar && (
                        <span dir="rtl" className="text-[11px]">{field.label_ar}</span>
                      )}
                    </div>
                    <FieldInput
                      field={field}
                      value={values[field.key] ?? null}
                      onChange={(v) => onFieldChange?.(field.key, v)}
                      lang={lang}
                      mode={mode}
                      locked={!!field.readonly_if_prefilled && prefilled}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {footerText && (
        <div className="text-center text-[11px] text-muted-foreground pt-3 pb-1">{footerText}</div>
      )}
    </div>
  );
};

export default FormRenderer;
