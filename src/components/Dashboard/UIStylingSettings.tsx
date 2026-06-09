import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Paintbrush } from "lucide-react";

interface UIStyles {
  thumbSize: number;
  thumbCheckedX: number;
  thumbUncheckedX: number;
  trackWidth: number;
  trackHeight: number;
  containerPadX: number;
  containerPadY: number;
  containerGap: number;
}

const DEFAULTS: UIStyles = {
  thumbSize: 14,
  thumbCheckedX: 16,
  thumbUncheckedX: 2,
  trackWidth: 36,
  trackHeight: 20,
  containerPadX: 8,
  containerPadY: 4,
  containerGap: 6,
};

export const applyUIStyles = (styles: UIStyles) => {
  const root = document.documentElement;
  root.style.setProperty("--switch-thumb-size", `${styles.thumbSize}px`);
  root.style.setProperty("--switch-thumb-checked-x", `${styles.thumbCheckedX}px`);
  root.style.setProperty("--switch-thumb-unchecked-x", `${styles.thumbUncheckedX}px`);
  root.style.setProperty("--switch-track-width", `${styles.trackWidth}px`);
  root.style.setProperty("--switch-track-height", `${styles.trackHeight}px`);
  root.style.setProperty("--switch-container-pad-x", `${styles.containerPadX}px`);
  root.style.setProperty("--switch-container-pad-y", `${styles.containerPadY}px`);
  root.style.setProperty("--switch-container-gap", `${styles.containerGap}px`);
};

export const loadUIStyles = async (): Promise<UIStyles> => {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("ui_styles")
      .limit(1)
      .single();
    if (data?.ui_styles && typeof data.ui_styles === "object") {
      return { ...DEFAULTS, ...(data.ui_styles as Partial<UIStyles>) };
    }
  } catch {}
  return DEFAULTS;
};

const SliderField = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-16 h-7 text-xs text-center"
          min={min}
          max={max}
          step={step}
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
    <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
  </div>
);

const UIStylingSettings = () => {
  const { lang } = useLanguage();
  const [styles, setStyles] = useState<UIStyles>(DEFAULTS);
  const [demoChecked, setDemoChecked] = useState(true);

  useEffect(() => {
    loadUIStyles().then(setStyles);
  }, []);

  useEffect(() => {
    applyUIStyles(styles);
  }, [styles]);

  const update = (key: keyof UIStyles, value: number) => {
    setStyles((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    const { error } = await supabase
      .from("site_settings")
      .update({ ui_styles: styles as any })
      .not("id", "is", null);
    if (error) {
      toast.error(lang === "ar" ? "حدث خطأ" : "Error saving");
    } else {
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
    }
  };

  const reset = () => {
    setStyles(DEFAULTS);
  };

  const isAr = lang === "ar";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paintbrush className="w-5 h-5" />
          <h3 className="text-lg font-bold">
            {isAr ? "ضبط تنسيق الأزرار" : "UI Styling Settings"}
          </h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            {isAr ? "إعادة تعيين" : "Reset"}
          </Button>
          <Button size="sm" onClick={save} className="gradient-accent text-accent-foreground">
            {isAr ? "حفظ" : "Save"}
          </Button>
        </div>
      </div>

      {/* Live Preview */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm mb-3 block">
            {isAr ? "معاينة مباشرة" : "Live Preview"}
          </Label>
          <div className="flex flex-wrap items-center justify-center gap-4 py-4 bg-muted/30 rounded-lg">
            <div className="ui-switch-chip bg-muted/50 rounded-lg" dir="ltr">
              <Switch checked={demoChecked} onCheckedChange={setDemoChecked} />
              <span className="ui-switch-label" dir={isAr ? "rtl" : "ltr"}>{isAr ? "ظاهر" : "Visible"}</span>
            </div>
            <div className="ui-switch-chip bg-muted/50 rounded-lg" dir="ltr">
              <Switch checked={!demoChecked} onCheckedChange={(v) => setDemoChecked(!v)} />
              <span className="ui-switch-label" dir={isAr ? "rtl" : "ltr"}>{isAr ? "إلزامي" : "Required"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4 space-y-4">
            <h4 className="font-semibold text-sm">
              {isAr ? "الدائرة الداخلية (Thumb)" : "Thumb (Circle)"}
            </h4>
            <SliderField
              label={isAr ? "حجم الدائرة" : "Thumb Size"}
              value={styles.thumbSize}
              min={8}
              max={24}
              onChange={(v) => update("thumbSize", v)}
            />
            <SliderField
              label={isAr ? "إزاحة عند التفعيل" : "Checked Position"}
              value={styles.thumbCheckedX}
              min={8}
              max={30}
              onChange={(v) => update("thumbCheckedX", v)}
            />
            <SliderField
              label={isAr ? "إزاحة عند الإيقاف" : "Unchecked Position"}
              value={styles.thumbUncheckedX}
              min={0}
              max={8}
              onChange={(v) => update("thumbUncheckedX", v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            <h4 className="font-semibold text-sm">
              {isAr ? "الإطار الخلفي (Track)" : "Track (Background)"}
            </h4>
            <SliderField
              label={isAr ? "عرض الإطار" : "Track Width"}
              value={styles.trackWidth}
              min={24}
              max={56}
              onChange={(v) => update("trackWidth", v)}
            />
            <SliderField
              label={isAr ? "ارتفاع الإطار" : "Track Height"}
              value={styles.trackHeight}
              min={14}
              max={32}
              onChange={(v) => update("trackHeight", v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            <h4 className="font-semibold text-sm">
              {isAr ? "المسافات (Padding)" : "Container Spacing"}
            </h4>
            <SliderField
              label={isAr ? "المسافة الأفقية" : "Horizontal Padding"}
              value={styles.containerPadX}
              min={2}
              max={20}
              onChange={(v) => update("containerPadX", v)}
            />
            <SliderField
              label={isAr ? "المسافة العمودية" : "Vertical Padding"}
              value={styles.containerPadY}
              min={2}
              max={16}
              onChange={(v) => update("containerPadY", v)}
            />
            <SliderField
              label={isAr ? "المسافة بين العناصر" : "Gap"}
              value={styles.containerGap}
              min={2}
              max={16}
              onChange={(v) => update("containerGap", v)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UIStylingSettings;
