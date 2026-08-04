// Admin-only structured editor for a template's schema (sections + fields).
// Deliberately form-based rather than free JSON: field types, sources,
// employee-field mappings and formulas are all picked from closed lists, so
// an admin can build any form without ever writing invalid schema.

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EMPLOYEE_FIELD_KEYS } from "@/lib/hrForms/templateEngine";
import { FORMULA_DESCRIPTIONS, FORMULA_NAMES } from "@/lib/hrForms/formulas";
import type { HrField, HrFieldType, HrSection, HrTemplateSchema } from "@/lib/hrForms/types";

const FIELD_TYPES: { value: HrFieldType; en: string; ar: string }[] = [
  { value: "text", en: "Text", ar: "نص" },
  { value: "textarea", en: "Long text", ar: "نص طويل" },
  { value: "number", en: "Number", ar: "رقم" },
  { value: "currency", en: "Currency", ar: "مبلغ" },
  { value: "date", en: "Date", ar: "تاريخ" },
  { value: "select", en: "Dropdown", ar: "قائمة منسدلة" },
  { value: "radio", en: "Choice (radio)", ar: "اختيار واحد" },
  { value: "checkbox", en: "Checkbox", ar: "خانة اختيار" },
  { value: "signature", en: "Signature (name + date)", ar: "توقيع (اسم وتاريخ)" },
  { value: "table", en: "Table (repeating rows)", ar: "جدول (صفوف متكررة)" },
  { value: "computed", en: "Computed (formula)", ar: "محسوب (معادلة)" },
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || `field_${Date.now()}`;

interface Props {
  schema: HrTemplateSchema;
  onChange: (schema: HrTemplateSchema) => void;
  lang: "en" | "ar";
}

const TemplateSchemaEditor = ({ schema, onChange, lang }: Props) => {
  const sections = schema.sections ?? [];
  const [editing, setEditing] = useState<{ sectionIdx: number; fieldIdx: number | null } | null>(null);

  const setSections = (next: HrSection[]) => onChange({ ...schema, sections: next });

  const updateSection = (idx: number, patch: Partial<HrSection>) =>
    setSections(sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const moveSection = (idx: number, delta: number) => {
    const to = idx + delta;
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    [next[idx], next[to]] = [next[to], next[idx]];
    setSections(next);
  };

  const moveField = (sIdx: number, fIdx: number, delta: number) => {
    const fields = [...sections[sIdx].fields];
    const to = fIdx + delta;
    if (to < 0 || to >= fields.length) return;
    [fields[fIdx], fields[to]] = [fields[to], fields[fIdx]];
    updateSection(sIdx, { fields });
  };

  const addSection = () =>
    setSections([
      ...sections,
      { key: `section_${sections.length + 1}`, title_en: "New Section", title_ar: "", fields: [] },
    ]);

  const addField = (sIdx: number) => {
    const fields = [
      ...sections[sIdx].fields,
      { key: `field_${sections[sIdx].fields.length + 1}`, type: "text", label_en: "New Field", source: "submission" } as HrField,
    ];
    updateSection(sIdx, { fields });
    setEditing({ sectionIdx: sIdx, fieldIdx: fields.length - 1 });
  };

  const saveField = (field: HrField) => {
    if (!editing || editing.fieldIdx === null) return;
    const fields = sections[editing.sectionIdx].fields.map((f, i) => (i === editing.fieldIdx ? field : f));
    updateSection(editing.sectionIdx, { fields });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      {sections.map((section, sIdx) => (
        <div key={sIdx} className="border border-border rounded-md">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 flex-wrap">
            <Input
              className="h-8 w-48"
              value={section.title_en}
              onChange={(e) => updateSection(sIdx, { title_en: e.target.value, key: section.key || slugify(e.target.value) })}
              placeholder="Section title (EN)"
            />
            <Input
              className="h-8 w-48"
              dir="rtl"
              value={section.title_ar ?? ""}
              onChange={(e) => updateSection(sIdx, { title_ar: e.target.value })}
              placeholder="عنوان القسم (عربي)"
            />
            <div className="ms-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveSection(sIdx, -1)}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveSection(sIdx, 1)}>
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => setSections(sections.filter((_, i) => i !== sIdx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-3 space-y-2">
            <Textarea
              rows={1}
              className="text-xs"
              value={section.note_en ?? ""}
              onChange={(e) => updateSection(sIdx, { note_en: e.target.value })}
              placeholder={lang === "ar" ? "ملاحظة/نص قانوني للقسم (إنجليزي، اختياري)" : "Section note / legal text (EN, optional)"}
            />
            {section.fields.map((field, fIdx) => (
              <div key={fIdx} className="flex items-center gap-2 border border-border rounded px-2 py-1.5 text-sm">
                <Badge variant="outline" className="shrink-0">
                  {FIELD_TYPES.find((t) => t.value === field.type)?.[lang === "ar" ? "ar" : "en"] ?? field.type}
                </Badge>
                <span className="truncate">{field.label_en}</span>
                <code className="text-xs text-muted-foreground truncate hidden sm:inline">{field.key}</code>
                {field.source === "employee" && (
                  <Badge className="shrink-0" variant="secondary">
                    {lang === "ar" ? "من ملف الموظف" : "employee"}
                  </Badge>
                )}
                {field.required && <span className="text-destructive">*</span>}
                <div className="ms-auto flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveField(sIdx, fIdx, -1)}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveField(sIdx, fIdx, 1)}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing({ sectionIdx: sIdx, fieldIdx: fIdx })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => updateSection(sIdx, { fields: section.fields.filter((_, i) => i !== fIdx) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addField(sIdx)}>
              <Plus className="h-3.5 w-3.5 me-1" />
              {lang === "ar" ? "إضافة حقل" : "Add field"}
            </Button>
          </div>
        </div>
      ))}

      <Button variant="secondary" onClick={addSection}>
        <Plus className="h-4 w-4 me-1" />
        {lang === "ar" ? "إضافة قسم" : "Add section"}
      </Button>

      {editing && editing.fieldIdx !== null && (
        <FieldEditorDialog
          field={sections[editing.sectionIdx].fields[editing.fieldIdx]}
          lang={lang}
          onClose={() => setEditing(null)}
          onSave={saveField}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

interface FieldEditorProps {
  field: HrField;
  lang: "en" | "ar";
  onClose: () => void;
  onSave: (field: HrField) => void;
}

const FieldEditorDialog = ({ field, lang, onClose, onSave }: FieldEditorProps) => {
  const [draft, setDraft] = useState<HrField>({ ...field });
  const set = (patch: Partial<HrField>) => setDraft((d) => ({ ...d, ...patch }));
  const isChoice = draft.type === "select" || draft.type === "radio";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lang === "ar" ? "تحرير الحقل" : "Edit Field"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{lang === "ar" ? "التسمية (إنجليزي)" : "Label (EN)"}</Label>
              <Input
                value={draft.label_en}
                onChange={(e) => set({ label_en: e.target.value, key: field.key.startsWith("field_") ? slugify(e.target.value) : draft.key })}
              />
            </div>
            <div className="space-y-1">
              <Label>{lang === "ar" ? "التسمية (عربي)" : "Label (AR)"}</Label>
              <Input dir="rtl" value={draft.label_ar ?? ""} onChange={(e) => set({ label_ar: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{lang === "ar" ? "المفتاح" : "Field key"}</Label>
              <Input dir="ltr" value={draft.key} onChange={(e) => set({ key: slugify(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>{lang === "ar" ? "النوع" : "Type"}</Label>
              <Select value={draft.type} onValueChange={(v) => set({ type: v as HrFieldType, source: v === "computed" ? "computed" : draft.source === "computed" ? "submission" : draft.source })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{lang === "ar" ? t.ar : t.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {draft.type !== "computed" && (
            <div className="space-y-1">
              <Label>{lang === "ar" ? "مصدر القيمة" : "Value source"}</Label>
              <Select value={draft.source} onValueChange={(v) => set({ source: v as HrField["source"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="submission">{lang === "ar" ? "يُعبأ في كل نموذج" : "Filled per submission"}</SelectItem>
                  <SelectItem value="employee">{lang === "ar" ? "تلقائي من ملف الموظف" : "Auto-filled from employee record"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {draft.source === "employee" && draft.type !== "computed" && (
            <div className="space-y-1">
              <Label>{lang === "ar" ? "حقل الموظف" : "Employee field"}</Label>
              <Select value={draft.employee_field ?? ""} onValueChange={(v) => set({ employee_field: v })}>
                <SelectTrigger><SelectValue placeholder={lang === "ar" ? "اختر..." : "Select..."} /></SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_FIELD_KEYS.map((k) => (
                    <SelectItem key={k} value={k}><code className="text-xs">{k}</code></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {draft.type === "computed" && (
            <div className="space-y-1">
              <Label>{lang === "ar" ? "المعادلة" : "Formula"}</Label>
              <Select
                value={/^\s*([a-z_]+)/.exec(draft.formula ?? "")?.[1] ?? ""}
                onValueChange={(name) => set({ formula: `${name}()` })}
              >
                <SelectTrigger><SelectValue placeholder={lang === "ar" ? "اختر معادلة..." : "Pick a formula..."} /></SelectTrigger>
                <SelectContent>
                  {FORMULA_NAMES.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n} — {FORMULA_DESCRIPTIONS[n]?.[lang] ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                dir="ltr"
                className="font-mono text-xs"
                value={draft.formula ?? ""}
                onChange={(e) => set({ formula: e.target.value })}
                placeholder="sum_fields(field_a, field_b)"
              />
              <p className="text-xs text-muted-foreground">
                {lang === "ar"
                  ? "ضع مفاتيح الحقول بين الأقواس مفصولة بفواصل."
                  : "Put field keys inside the parentheses, comma-separated."}
              </p>
            </div>
          )}

          {isChoice && (
            <div className="space-y-1">
              <Label>{lang === "ar" ? "الخيارات (سطر لكل خيار: value | English | عربي)" : "Options (one per line: value | English | Arabic)"}</Label>
              <Textarea
                rows={4}
                dir="ltr"
                className="font-mono text-xs"
                value={(draft.options ?? []).map((o) => [o.value, o.label_en, o.label_ar ?? ""].join(" | ")).join("\n")}
                onChange={(e) =>
                  set({
                    options: e.target.value
                      .split("\n")
                      .map((line) => line.split("|").map((p) => p.trim()))
                      .filter((parts) => parts[0])
                      .map(([value, label_en, label_ar]) => ({ value, label_en: label_en || value, label_ar: label_ar || undefined })),
                  })
                }
              />
            </div>
          )}

          {draft.type === "table" && (
            <div className="space-y-1">
              <Label>{lang === "ar" ? "أعمدة الجدول (سطر لكل عمود: key | English | عربي | text/number)" : "Table columns (one per line: key | English | Arabic | text/number)"}</Label>
              <Textarea
                rows={4}
                dir="ltr"
                className="font-mono text-xs"
                value={(draft.columns ?? []).map((c) => [c.key, c.label_en, c.label_ar ?? "", c.type].join(" | ")).join("\n")}
                onChange={(e) =>
                  set({
                    columns: e.target.value
                      .split("\n")
                      .map((line) => line.split("|").map((p) => p.trim()))
                      .filter((parts) => parts[0])
                      .map(([key, label_en, label_ar, type]) => ({
                        key: slugify(key),
                        label_en: label_en || key,
                        label_ar: label_ar || undefined,
                        type: type === "number" ? "number" : "text",
                      })),
                  })
                }
              />
            </div>
          )}

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={!!draft.required} onCheckedChange={(c) => set({ required: !!c })} />
              {lang === "ar" ? "إلزامي" : "Required"}
            </label>
            {draft.source === "employee" && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={!!draft.readonly_if_prefilled} onCheckedChange={(c) => set({ readonly_if_prefilled: !!c })} />
                {lang === "ar" ? "غير قابل للتعديل عند التعبئة التلقائية" : "Lock when auto-filled"}
              </label>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={() => onSave(draft)}>{lang === "ar" ? "حفظ الحقل" : "Save field"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateSchemaEditor;
