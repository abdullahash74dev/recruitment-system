import { useLanguage } from "@/contexts/LanguageContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Settings2, GripVertical, RotateCcw } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChartType, DashboardDensity, DashboardScale, DashboardTheme, SECTION_LABELS, SectionPref, useDashboardPrefs } from "@/hooks/useDashboardPrefs";

const CHART_OPTIONS: { value: ChartType; ar: string; en: string }[] = [
  { value: "pie", ar: "دائري", en: "Pie" },
  { value: "donut", ar: "دائري مفرغ", en: "Donut" },
  { value: "bar", ar: "أعمدة", en: "Bar" },
  { value: "barH", ar: "أعمدة أفقي", en: "Bar (Horizontal)" },
  { value: "line", ar: "خطي", en: "Line" },
  { value: "area", ar: "مساحي", en: "Area" },
];

const THEME_OPTIONS: { value: DashboardTheme; ar: string; en: string; colors: string; futuristic?: boolean }[] = [
  { value: "executive", ar: "تنفيذي أزرق", en: "Executive Blue", colors: "linear-gradient(135deg, hsl(220 55% 18%), hsl(145 58% 45%))" },
  { value: "aurora", ar: "Aurora عالمي", en: "Global Aurora", colors: "linear-gradient(135deg, hsl(190 85% 45%), hsl(242 78% 62%), hsl(270 70% 58%))" },
  { value: "emerald", ar: "زمردي فاخر", en: "Emerald Prestige", colors: "linear-gradient(135deg, hsl(160 80% 18%), hsl(174 66% 34%), hsl(42 68% 52%))" },
  { value: "graphite", ar: "Graphite احترافي", en: "Professional Graphite", colors: "linear-gradient(135deg, hsl(220 16% 12%), hsl(215 22% 28%), hsl(210 10% 58%))" },
  { value: "royal", ar: "Royal Gold", en: "Royal Gold", colors: "linear-gradient(135deg, hsl(225 45% 10%), hsl(220 65% 24%), hsl(42 70% 55%))" },
  { value: "cyberpunk", ar: "Cyberpunk نيون", en: "Cyberpunk Neon", colors: "linear-gradient(135deg, hsl(290 100% 12%), hsl(320 90% 45%), hsl(180 100% 50%))", futuristic: true },
  { value: "neon", ar: "Neon مستقبلي", en: "Neon Future", colors: "linear-gradient(135deg, hsl(220 80% 8%), hsl(195 100% 50%), hsl(140 90% 55%))", futuristic: true },
  { value: "holographic", ar: "Holographic هولوغرام", en: "Holographic", colors: "linear-gradient(135deg, hsl(260 90% 60%), hsl(180 85% 55%), hsl(320 85% 65%), hsl(45 95% 60%))", futuristic: true },
  { value: "matrix", ar: "Matrix رقمي", en: "Matrix Digital", colors: "linear-gradient(135deg, hsl(120 100% 6%), hsl(140 95% 30%), hsl(120 100% 55%))", futuristic: true },
];

const SCALE_OPTIONS: { value: DashboardScale; ar: string; en: string }[] = [
  { value: "sm", ar: "صغير", en: "Small" },
  { value: "md", ar: "متوسط", en: "Medium" },
  { value: "lg", ar: "كبير", en: "Large" },
  { value: "xl", ar: "ضخم", en: "Extra Large" },
];

const SortableRow = ({ section, onToggle, onChart, lang }: {
  section: SectionPref;
  onToggle: () => void;
  onChart: (c: ChartType) => void;
  lang: "ar" | "en";
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const label = SECTION_LABELS[section.id]?.[lang] || section.id;
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border p-2 bg-card">
      <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground">
        <GripVertical className="w-4 h-4" />
      </button>
      <Switch checked={section.visible} onCheckedChange={onToggle} />
      <div className="flex-1 text-sm font-medium truncate">{label}</div>
      {section.chart && (
        <Select value={section.chart} onValueChange={(v) => onChart(v as ChartType)}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CHART_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{lang === "ar" ? o.ar : o.en}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

const DashboardCustomizer = () => {
  const { lang } = useLanguage();
  const { prefs, save, reset } = useDashboardPrefs();
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = prefs.sections.findIndex(s => s.id === active.id);
    const newIdx = prefs.sections.findIndex(s => s.id === over.id);
    save({ ...prefs, sections: arrayMove(prefs.sections, oldIdx, newIdx) });
  };

  const update = (id: string, patch: Partial<SectionPref>) => {
    save({ ...prefs, sections: prefs.sections.map(s => s.id === id ? { ...s, ...patch } : s) });
  };

  const updateTheme = (theme: DashboardTheme) => save({ ...prefs, theme });
  const updateDensity = (density: DashboardDensity) => save({ ...prefs, density });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" />
          {lang === "ar" ? "تخصيص" : "Customize"}
        </Button>
      </SheetTrigger>
      <SheetContent side={lang === "ar" ? "left" : "right"} className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>{lang === "ar" ? "تخصيص الداش بورد" : "Customize Dashboard"}</span>
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1 text-xs">
              <RotateCcw className="w-3 h-3" />{lang === "ar" ? "افتراضي" : "Reset"}
            </Button>
          </SheetTitle>
        </SheetHeader>
        <p className="text-xs text-muted-foreground mt-2 mb-3">
          {lang === "ar" ? "اختر ثيم عالمي، ثم اسحب لإعادة الترتيب وغيّر نوع الرسم." : "Choose a global theme, then reorder sections and chart types."}
        </p>
        <div className="space-y-4 mb-5">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "ثيم الداشبورد" : "Dashboard theme"}</div>
            <div className="grid grid-cols-1 gap-2">
              {THEME_OPTIONS.map(theme => (
                <button key={theme.value} type="button" onClick={() => updateTheme(theme.value)} className={`relative flex items-center gap-3 rounded-lg border p-2 text-start transition ${prefs.theme === theme.value ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted/60"}`}>
                  <span className="h-8 w-14 shrink-0 rounded-md" style={{ background: theme.colors, boxShadow: theme.futuristic ? "0 0 14px hsl(var(--primary) / 0.45)" : undefined }} />
                  <span className="flex-1 text-sm font-medium flex items-center gap-2">
                    {lang === "ar" ? theme.ar : theme.en}
                    {theme.futuristic && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-white">{lang === "ar" ? "مستقبلي" : "Future"}</span>}
                  </span>
                  {prefs.theme === theme.value && <span className="h-2 w-2 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "حجم الداشبورد" : "Dashboard size"}</div>
            <Select value={prefs.scale || "md"} onValueChange={(v) => save({ ...prefs, scale: v as DashboardScale })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCALE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{lang === "ar" ? o.ar : o.en}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "كثافة العرض" : "Display density"}</div>
            <Select value={prefs.density} onValueChange={(v) => updateDensity(v as DashboardDensity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">{lang === "ar" ? "مريح وواسع" : "Comfortable"}</SelectItem>
                <SelectItem value="compact">{lang === "ar" ? "مضغوط احترافي" : "Compact"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
            <div className="text-xs font-semibold text-muted-foreground">{lang === "ar" ? "عنوان الداشبورد (خاص بحسابك)" : "Dashboard title (your account)"}</div>
            <Input
              value={prefs.customEyebrow || ""}
              onChange={(e) => save({ ...prefs, customEyebrow: e.target.value })}
              placeholder={lang === "ar" ? "نص علوي صغير (اختياري)" : "Small eyebrow (optional)"}
              className="h-8 text-xs"
            />
            <Input
              value={prefs.customTitle || ""}
              onChange={(e) => save({ ...prefs, customTitle: e.target.value })}
              placeholder={lang === "ar" ? "العنوان الرئيسي" : "Main title"}
              className="h-9"
            />
            <Input
              value={prefs.customSubtitle || ""}
              onChange={(e) => save({ ...prefs, customSubtitle: e.target.value })}
              placeholder={lang === "ar" ? "الوصف تحت العنوان" : "Subtitle / description"}
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">{lang === "ar" ? "يظهر فقط في حسابك ولا يؤثر على باقي المستخدمين." : "Visible only to your account."}</p>
          </div>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={prefs.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {prefs.sections.map(s => (
                <SortableRow key={s.id} section={s} lang={lang}
                  onToggle={() => update(s.id, { visible: !s.visible })}
                  onChart={(c) => update(s.id, { chart: c })} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </SheetContent>
    </Sheet>
  );
};

export default DashboardCustomizer;
