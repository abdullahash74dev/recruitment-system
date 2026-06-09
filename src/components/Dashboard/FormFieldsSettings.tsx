import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Eye, EyeOff, GripVertical, FormInput, Lock, LockOpen } from "lucide-react";
import { invalidateFieldConfigCache, type FieldConfig } from "@/hooks/useFieldConfig";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const STEP_LABELS_AR = ["البيانات الأساسية", "التفضيلات الوظيفية", "المؤهل العلمي", "الخبرات والمهارات", "التوقعات المالية", "المرفقات"];
const STEP_LABELS_EN = ["Basic Info", "Job Preferences", "Education", "Experience & Skills", "Financial", "Attachments"];

interface SortableFieldProps {
  field: FieldConfig;
  lang: string;
  onToggleVisible: (id: string, v: boolean) => void;
  onToggleRequired: (id: string, v: boolean) => void;
  onEdit: (f: FieldConfig) => void;
  isLocked: boolean;
}

const ToggleChip = ({
  label,
  checked,
  onCheckedChange,
  labelDir,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  labelDir: "rtl" | "ltr";
}) => (
  <div className="ui-switch-chip bg-muted/50 rounded-md" dir="ltr">
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
    <span className="ui-switch-label" dir={labelDir}>{label}</span>
  </div>
);

const SortableField = ({ field: f, lang, onToggleVisible, onToggleRequired, onEdit, isLocked }: SortableFieldProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id, disabled: isLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={!f.is_visible ? "opacity-50" : ""}>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button {...attributes} {...listeners} className={`touch-none shrink-0 ${isLocked ? "cursor-not-allowed opacity-30" : "cursor-grab active:cursor-grabbing"}`} disabled={isLocked}>
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {lang === "ar" ? (f.label_ar || f.field_name) : (f.label_en || f.field_name)}
              </p>
              <p className="text-xs text-muted-foreground">{f.field_name}</p>
            </div>

            <div className="ui-switch-row shrink-0">
              <ToggleChip
                label={lang === "ar" ? "ظاهر" : "Vis"}
                checked={f.is_visible}
                onCheckedChange={(v) => onToggleVisible(f.id, v)}
                labelDir={lang === "ar" ? "rtl" : "ltr"}
              />
              <ToggleChip
                label={lang === "ar" ? "إلزامي" : "Req"}
                checked={f.is_required}
                onCheckedChange={(v) => onToggleRequired(f.id, v)}
                labelDir={lang === "ar" ? "rtl" : "ltr"}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onEdit(f)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const FormFieldsSettings = () => {
  const { t, lang, dir } = useLanguage();
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [activeStep, setActiveStep] = useState("1");
  const [editField, setEditField] = useState<FieldConfig | null>(null);
  const [editForm, setEditForm] = useState({ label_ar: "", label_en: "", sort_order: 0 });
  const [isReorderLocked, setIsReorderLocked] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { fetchFields(); }, []);

  const fetchFields = async () => {
    const { data } = await supabase
      .from("form_field_config")
      .select("*")
      .order("step_number", { ascending: true })
      .order("sort_order", { ascending: true });
    if (data) setFields(data as FieldConfig[]);
  };

  const toggleVisible = async (id: string, visible: boolean) => {
    await supabase.from("form_field_config").update({ is_visible: visible }).eq("id", id);
    invalidateFieldConfigCache();
    setFields(prev => prev.map(f => f.id === id ? { ...f, is_visible: visible } : f));
    toast.success(t("dash.saved"));
  };

  const toggleRequired = async (id: string, required: boolean) => {
    await supabase.from("form_field_config").update({ is_required: required }).eq("id", id);
    invalidateFieldConfigCache();
    setFields(prev => prev.map(f => f.id === id ? { ...f, is_required: required } : f));
    toast.success(t("dash.saved"));
  };

  const openEdit = (f: FieldConfig) => {
    setEditField(f);
    setEditForm({ label_ar: f.label_ar || "", label_en: f.label_en || "", sort_order: f.sort_order });
  };

  const saveEdit = async () => {
    if (!editField) return;
    await supabase.from("form_field_config").update({
      label_ar: editForm.label_ar || null,
      label_en: editForm.label_en || null,
      sort_order: editForm.sort_order,
    }).eq("id", editField.id);
    invalidateFieldConfigCache();
    fetchFields();
    setEditField(null);
    toast.success(t("dash.saved"));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const stepNum = parseInt(activeStep);
    const stepFields = fields.filter(f => f.step_number === stepNum);
    const oldIndex = stepFields.findIndex(f => f.id === active.id);
    const newIndex = stepFields.findIndex(f => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(stepFields, oldIndex, newIndex);

    // Update local state immediately
    const otherFields = fields.filter(f => f.step_number !== stepNum);
    const updatedReordered = reordered.map((f, i) => ({ ...f, sort_order: i }));
    setFields([...otherFields, ...updatedReordered].sort((a, b) => a.step_number - b.step_number || a.sort_order - b.sort_order));

    // Persist to DB
    const updates = updatedReordered.map(f =>
      supabase.from("form_field_config").update({ sort_order: f.sort_order }).eq("id", f.id)
    );
    await Promise.all(updates);
    invalidateFieldConfigCache();
    toast.success(lang === "ar" ? "تم تحديث الترتيب" : "Order updated");
  };

  const stepLabels = lang === "ar" ? STEP_LABELS_AR : STEP_LABELS_EN;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FormInput className="w-5 h-5" />
          <h3 className="text-lg font-bold">{lang === "ar" ? "إدارة حقول نموذج التقديم" : "Manage Application Form Fields"}</h3>
        </div>
        <Button
          variant={isReorderLocked ? "outline" : "default"}
          size="sm"
          onClick={() => setIsReorderLocked(!isReorderLocked)}
          className="gap-2"
        >
          {isReorderLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
          {isReorderLocked
            ? (lang === "ar" ? "الترتيب مقفل" : "Reorder Locked")
            : (lang === "ar" ? "الترتيب مفتوح" : "Reorder Unlocked")}
        </Button>
      </div>

      <Tabs value={activeStep} onValueChange={setActiveStep} dir={dir}>
        <TabsList className="flex flex-wrap gap-1 h-auto">
          {stepLabels.map((label, i) => (
            <TabsTrigger key={i + 1} value={String(i + 1)} className="text-xs">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {stepLabels.map((_, i) => {
          const stepFields = fields.filter(f => f.step_number === i + 1);
          return (
            <TabsContent key={i + 1} value={String(i + 1)} className="space-y-2 mt-4">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={stepFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  {stepFields.map((f) => (
                    <SortableField
                      key={f.id}
                      field={f}
                      lang={lang}
                      onToggleVisible={toggleVisible}
                      onToggleRequired={toggleRequired}
                      onEdit={openEdit}
                      isLocked={isReorderLocked}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Edit Label Dialog */}
      <Dialog open={!!editField} onOpenChange={(o) => !o && setEditField(null)}>
        <DialogContent className="max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "تعديل تسمية الحقل" : "Edit Field Label"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{lang === "ar" ? "التسمية بالعربية" : "Arabic Label"}</Label>
              <Input value={editForm.label_ar} onChange={e => setEditForm(p => ({ ...p, label_ar: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{lang === "ar" ? "التسمية بالإنجليزية" : "English Label"}</Label>
              <Input value={editForm.label_en} onChange={e => setEditForm(p => ({ ...p, label_en: e.target.value }))} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{lang === "ar" ? "الترتيب" : "Sort Order"}</Label>
              <Input type="number" value={editForm.sort_order} onChange={e => setEditForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setEditField(null)}>{t("dash.cancel")}</Button>
              <Button onClick={saveEdit} className="gradient-accent text-accent-foreground">{t("dash.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormFieldsSettings;
