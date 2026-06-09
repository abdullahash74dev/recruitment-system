import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, List, RotateCcw, Plus, Lock, Unlock, Search, Trash2 } from "lucide-react";
import { useDeletePin } from "@/components/DeletePinDialog";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { invalidateDropdownCache } from "@/hooks/useDropdownOptions";
import SortableItem, { type EditableOption } from "./DropdownEditor/SortableItem";
import ExcelImportExport from "./DropdownEditor/ExcelImportExport";
import {
  getNationalities, getSaudiCities, getEducationLevels, getJobPositions,
  getYearsOfExperience, getSalaryRanges, getGenderOptions, getMaritalStatusOptions,
  getYesNoOptions, getLanguageLevels, getJobTypes, getHearAboutOptions,
  getAvailableDates, getFacilityMgmtOptions,
} from "@/data/jobPositions";

interface DropdownOption {
  id?: string;
  field_name: string;
  options_ar: string[];
  options_en: string[];
  is_active: boolean;
}

const FIELD_CONFIGS = [
  { key: "gender", labelAr: "الجنس", labelEn: "Gender", descAr: "ذكر / أنثى", descEn: "Male / Female", getDefaultAr: () => getGenderOptions("ar"), getDefaultEn: () => getGenderOptions("en") },
  { key: "marital_status", labelAr: "الحالة الاجتماعية", labelEn: "Marital Status", descAr: "أعزب / متزوج ...", descEn: "Single / Married ...", getDefaultAr: () => getMaritalStatusOptions("ar"), getDefaultEn: () => getMaritalStatusOptions("en") },
  { key: "yes_no", labelAr: "خيارات نعم / لا", labelEn: "Yes / No Options", descAr: "تُستخدم في: هل لديك مواصلات، هل تعمل حالياً، هل تدرس حالياً", descEn: "Used in: Transport, Currently Employed, Currently Studying", getDefaultAr: () => getYesNoOptions("ar"), getDefaultEn: () => getYesNoOptions("en") },
  { key: "nationalities", labelAr: "الجنسيات", labelEn: "Nationalities", descAr: "", descEn: "", getDefaultAr: () => getNationalities("ar"), getDefaultEn: () => getNationalities("en") },
  { key: "current_cities", labelAr: "المدينة الحالية", labelEn: "Current City", descAr: "تُستخدم في: المدينة التي يقيم فيها المتقدم حالياً", descEn: "Used in: Applicant's current city of residence", getDefaultAr: () => getSaudiCities("ar"), getDefaultEn: () => getSaudiCities("en") },
  { key: "preferred_cities", labelAr: "المدينة المفضلة للعمل", labelEn: "Preferred Work City", descAr: "تُستخدم في: المدينة المفضلة عند الانضمام للعمل", descEn: "Used in: Preferred city when joining for work", getDefaultAr: () => getSaudiCities("ar"), getDefaultEn: () => getSaudiCities("en") },
  { key: "education_levels", labelAr: "المؤهلات العلمية", labelEn: "Education Levels", descAr: "", descEn: "", getDefaultAr: () => getEducationLevels("ar"), getDefaultEn: () => getEducationLevels("en") },
  { key: "job_positions", labelAr: "المسميات الوظيفية", labelEn: "Job Positions", descAr: "", descEn: "", getDefaultAr: () => getJobPositions("ar"), getDefaultEn: () => getJobPositions("en") },
  { key: "years_experience", labelAr: "سنوات الخبرة", labelEn: "Years of Experience", descAr: "", descEn: "", getDefaultAr: () => getYearsOfExperience("ar"), getDefaultEn: () => getYearsOfExperience("en") },
  { key: "salary_ranges", labelAr: "نطاقات الرواتب", labelEn: "Salary Ranges", descAr: "تُستخدم في: الراتب الحالي والمتوقع", descEn: "Used in: Current & Expected Salary", getDefaultAr: () => getSalaryRanges("ar"), getDefaultEn: () => getSalaryRanges("en") },
  { key: "language_levels", labelAr: "مستويات اللغة", labelEn: "Language Levels", descAr: "تُستخدم في: مستوى العربية والإنجليزية", descEn: "Used in: Arabic & English Level", getDefaultAr: () => getLanguageLevels("ar"), getDefaultEn: () => getLanguageLevels("en") },
  { key: "job_types", labelAr: "أنواع الوظائف", labelEn: "Job Types", descAr: "دوام كامل / جزئي ...", descEn: "Full-time / Part-time ...", getDefaultAr: () => getJobTypes("ar"), getDefaultEn: () => getJobTypes("en") },
  { key: "hear_about", labelAr: "كيف سمعت عنا", labelEn: "How Did You Hear About Us", descAr: "", descEn: "", getDefaultAr: () => getHearAboutOptions("ar"), getDefaultEn: () => getHearAboutOptions("en") },
  { key: "available_dates", labelAr: "مواعيد الانضمام", labelEn: "Available Dates", descAr: "", descEn: "", getDefaultAr: () => getAvailableDates("ar"), getDefaultEn: () => getAvailableDates("en") },
  { key: "facility_mgmt", labelAr: "خبرة إدارة المرافق", labelEn: "Facility Management Experience", descAr: "", descEn: "", getDefaultAr: () => getFacilityMgmtOptions("ar"), getDefaultEn: () => getFacilityMgmtOptions("en") },
];

const DropdownOptionsSettings = () => {
  const { t, lang, dir } = useLanguage();
  const { requestDelete } = useDeletePin();
  const [dbOptions, setDbOptions] = useState<Record<string, DropdownOption>>({});
  const [showEditor, setShowEditor] = useState(false);
  const [editingField, setEditingField] = useState<typeof FIELD_CONFIGS[0] | null>(null);
  const [items, setItems] = useState<EditableOption[]>([]);
  const [newAr, setNewAr] = useState("");
  const [newEn, setNewEn] = useState("");
  const [locked, setLocked] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => { fetchOptions(); }, []);

  const fetchOptions = async () => {
    const { data } = await supabase.from("dropdown_options").select("*");
    const map: Record<string, DropdownOption> = {};
    (data || []).forEach((d: any) => { map[d.field_name] = d; });
    setDbOptions(map);
  };

  const openEditor = (field: typeof FIELD_CONFIGS[0]) => {
    setEditingField(field);
    setLocked(true);
    setSearchQuery("");
    const existing = dbOptions[field.key];
    const defaultAr = field.getDefaultAr();
    const defaultEn = field.getDefaultEn();

    if (existing && existing.options_ar.length > 0) {
      const savedItems: EditableOption[] = existing.options_ar.map((ar, i) => ({
        id: crypto.randomUUID(), ar, en: existing.options_en[i] || ar, enabled: true,
      }));
      defaultAr.forEach((ar, i) => {
        const en = defaultEn[i] || ar;
        if (!savedItems.some(s => s.ar === ar || s.en === en)) {
          savedItems.push({ id: crypto.randomUUID(), ar, en, enabled: false });
        }
      });
      setItems(savedItems);
    } else {
      setItems(defaultAr.map((ar, i) => ({ id: crypto.randomUUID(), ar, en: defaultEn[i] || ar, enabled: true })));
    }
    setNewAr(""); setNewEn("");
    setShowEditor(true);
  };

  const toggleItem = (id: string) => {
    if (locked) return;
    setItems(prev => prev.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item));
  };
  const updateItem = (id: string, field: "ar" | "en", value: string) => {
    if (locked) return;
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const removeItem = (id: string) => {
    if (locked) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };
  const addItem = () => {
    if (locked || (!newAr.trim() && !newEn.trim())) return;
    setItems(prev => [...prev, { id: crypto.randomUUID(), ar: newAr.trim(), en: newEn.trim() || newAr.trim(), enabled: true }]);
    setNewAr(""); setNewEn("");
  };
  const toggleAll = (enabled: boolean) => {
    if (locked) return;
    setItems(prev => prev.map(item => ({ ...item, enabled })));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (locked) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(item => item.id === active.id);
    const newIndex = items.findIndex(item => item.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) setItems(arrayMove(items, oldIndex, newIndex));
  };

  const saveOptions = async () => {
    if (!editingField) return;
    const enabledItems = items.filter(i => i.enabled);
    const optionsAr = enabledItems.map(i => i.ar).filter(Boolean);
    const optionsEn = enabledItems.map(i => i.en).filter(Boolean);

    if (optionsAr.length === 0) {
      toast.error(lang === "ar" ? "يجب تفعيل خيار واحد على الأقل" : "At least one option must be enabled");
      return;
    }

    const existing = dbOptions[editingField.key];
    if (existing?.id) {
      const { error } = await supabase.from("dropdown_options").update({ options_ar: optionsAr, options_en: optionsEn }).eq("id", existing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("dropdown_options").insert({ field_name: editingField.key, options_ar: optionsAr, options_en: optionsEn });
      if (error) { toast.error(error.message); return; }
    }

    invalidateDropdownCache();
    toast.success(t("dash.saved"));
    fetchOptions();
    setShowEditor(false);
  };

  const resetToDefault = () => {
    if (!editingField || locked) return;
    const defaultAr = editingField.getDefaultAr();
    const defaultEn = editingField.getDefaultEn();
    setItems(defaultAr.map((ar, i) => ({ id: crypto.randomUUID(), ar, en: defaultEn[i] || ar, enabled: true })));
  };

  const enabledCount = items.filter(i => i.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <List className="w-5 h-5" />
        <h3 className="text-lg font-bold">{lang === "ar" ? "تخصيص القوائم المنسدلة" : "Customize Dropdown Lists"}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FIELD_CONFIGS.map((field) => {
          const existing = dbOptions[field.key];
          const count = existing?.options_ar?.length || (lang === "ar" ? field.getDefaultAr().length : field.getDefaultEn().length);
          const isCustomized = !!existing?.id;
          return (
            <Card key={field.key} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEditor(field)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{lang === "ar" ? field.labelAr : field.labelEn}</p>
                  {(lang === "ar" ? field.descAr : field.descEn) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? field.descAr : field.descEn}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{count} {lang === "ar" ? "خيار مفعّل" : "active"}</span>
                    {isCustomized && <Badge variant="secondary" className="text-xs">{lang === "ar" ? "مخصص" : "Customized"}</Badge>}
                  </div>
                </div>
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" dir={dir}>
          <DialogHeader>
            <DialogTitle>
              {lang === "ar" ? `تعديل: ${editingField?.labelAr}` : `Edit: ${editingField?.labelEn}`}
            </DialogTitle>
          </DialogHeader>

          {/* Lock toggle + toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Button
                variant={locked ? "destructive" : "outline"}
                size="sm"
                onClick={() => setLocked(!locked)}
                className="gap-1.5"
              >
                {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                {locked
                  ? (lang === "ar" ? "مقفل - اضغط لفتح التعديل" : "Locked - Click to unlock")
                  : (lang === "ar" ? "مفتوح - التعديل متاح" : "Unlocked - Editing enabled")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {enabledCount} / {items.length} {lang === "ar" ? "مفعّل" : "enabled"}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => toggleAll(true)} disabled={locked}>
                {lang === "ar" ? "تفعيل الكل" : "Enable All"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleAll(false)} disabled={locked}>
                {lang === "ar" ? "تعطيل الكل" : "Disable All"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={locked || items.length === 0}
                onClick={() => {
                  requestDelete({
                    message: lang === "ar"
                      ? `سيتم حذف جميع الخيارات (${items.length}) من هذه القائمة نهائياً.`
                      : `All ${items.length} options in this list will be permanently removed.`,
                    onConfirm: async () => {
                      setItems([]);
                      toast.success(lang === "ar" ? "تم حذف جميع الخيارات. اضغط حفظ لتثبيت التغيير." : "All options removed. Click Save to confirm.");
                    },
                  });
                }}
                className="gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {lang === "ar" ? "حذف الكل" : "Delete All"}
              </Button>
            </div>
          </div>

          {/* Excel import/export */}
          <ExcelImportExport
            fieldLabel={lang === "ar" ? (editingField?.labelAr || "") : (editingField?.labelEn || "")}
            items={items}
            lang={lang}
            onImport={(imported) => { if (!locked) setItems(imported); else toast.error(lang === "ar" ? "افتح القفل أولاً" : "Unlock first"); }}
          />

          {/* Search filter */}
          {items.length > 10 && (
            <div className="relative">
              <Search className="w-4 h-4 absolute top-2.5 text-muted-foreground" style={{ [dir === "rtl" ? "right" : "left"]: "0.75rem" }} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === "ar" ? "بحث في الخيارات..." : "Search options..."}
                className="h-9 text-sm"
                style={{ [dir === "rtl" ? "paddingRight" : "paddingLeft"]: "2.25rem" }}
                dir={dir}
              />
            </div>
          )}

          {/* Items list with drag and drop */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[40vh] border rounded-lg p-3">
                {items.filter(item => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return item.ar.toLowerCase().includes(q) || item.en.toLowerCase().includes(q);
                }).map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    locked={locked}
                    lang={lang}
                    onToggle={toggleItem}
                    onUpdate={updateItem}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add new */}
          {!locked && (
            <div className="flex items-center gap-2 border rounded-lg p-3 bg-muted/30">
              <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input value={newAr} onChange={(e) => setNewAr(e.target.value)} className="text-sm h-8" dir="rtl" placeholder={lang === "ar" ? "اسم الخيار بالعربي" : "Option in Arabic"} onKeyDown={(e) => e.key === "Enter" && addItem()} />
                <Input value={newEn} onChange={(e) => setNewEn(e.target.value)} className="text-sm h-8" dir="ltr" placeholder={lang === "ar" ? "اسم الخيار بالإنجليزي" : "Option in English"} onKeyDown={(e) => e.key === "Enter" && addItem()} />
              </div>
              <Button variant="outline" size="sm" onClick={addItem} className="shrink-0">
                {lang === "ar" ? "إضافة" : "Add"}
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-between">
            <Button variant="outline" onClick={resetToDefault} disabled={locked} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              {lang === "ar" ? "استعادة الافتراضي" : "Reset to Default"}
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowEditor(false)}>{t("dash.cancel")}</Button>
              <Button onClick={saveOptions} className="gradient-accent text-accent-foreground">{t("dash.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DropdownOptionsSettings;
