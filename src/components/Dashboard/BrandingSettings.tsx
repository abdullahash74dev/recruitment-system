import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Palette, Upload, Save, Image, Wand2, Flag, RotateCcw } from "lucide-react";
import { invalidateSiteSettingsCache } from "@/hooks/useSiteSettings";
import { refreshSiteLogo } from "@/components/SiteLogo";
import { MAX_INLINE_IMAGE_SIZE, readImageAsDataUrl } from "@/lib/imageUpload";

interface Settings {
  id: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  site_name_ar: string;
  site_name_en: string;
  logo_height: string;
  logo_alignment: string;
  logo_border_radius: string;
  logo_bg_enabled: boolean;
  // advanced
  logo_padding: number;
  logo_bg_color: string | null;
  logo_shadow: boolean;
  logo_border: boolean;
  logo_rotation: number;
  logo_offset_x: number;
  logo_offset_y: number;
  logo_fit: string;
  logo_width: number | null;
  // mobile overrides
  logo_height_mobile: number | null;
  logo_width_mobile: number | null;
  logo_padding_mobile: number | null;
  logo_bg_color_mobile: string | null;
  logo_border_radius_mobile: string | null;
  // section bg colors
  hero_bg_color: string | null;
  hero_bg_color_mobile: string | null;
  features_bg_color: string | null;
  stats_bg_color: string | null;
  cta_bg_color: string | null;
  hero_title_size_desktop: string | null;
  hero_title_size_mobile: string | null;
  // job page
  show_nationality_on_jobs: boolean;
}

const BrandingSettings = () => {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [settings, setSettings] = useState<Settings | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removingBg, setRemovingBg] = useState<null | "transparent" | "white">(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from("site_settings").select("*").limit(1).single();
    if (data) setSettings({
      id: data.id,
      logo_url: data.logo_url,
      primary_color: data.primary_color || "#3b82f6",
      accent_color: data.accent_color || "#22d3ee",
      site_name_ar: data.site_name_ar || "",
      site_name_en: data.site_name_en || "",
      logo_height: (data as any).logo_height || "56",
      logo_alignment: (data as any).logo_alignment || "start",
      logo_border_radius: (data as any).logo_border_radius || "8",
      logo_bg_enabled: (data as any).logo_bg_enabled ?? true,
      logo_padding: (data as any).logo_padding ?? 8,
      logo_bg_color: (data as any).logo_bg_color ?? null,
      logo_shadow: (data as any).logo_shadow ?? false,
      logo_border: (data as any).logo_border ?? false,
      logo_rotation: (data as any).logo_rotation ?? 0,
      logo_offset_x: (data as any).logo_offset_x ?? 0,
      logo_offset_y: (data as any).logo_offset_y ?? 0,
      logo_fit: (data as any).logo_fit ?? "contain",
      logo_width: (data as any).logo_width ?? null,
      logo_height_mobile: (data as any).logo_height_mobile ?? null,
      logo_width_mobile: (data as any).logo_width_mobile ?? null,
      logo_padding_mobile: (data as any).logo_padding_mobile ?? null,
      logo_bg_color_mobile: (data as any).logo_bg_color_mobile ?? null,
      logo_border_radius_mobile: (data as any).logo_border_radius_mobile ?? null,
      hero_bg_color: (data as any).hero_bg_color ?? null,
      hero_bg_color_mobile: (data as any).hero_bg_color_mobile ?? null,
      features_bg_color: (data as any).features_bg_color ?? null,
      stats_bg_color: (data as any).stats_bg_color ?? null,
      cta_bg_color: (data as any).cta_bg_color ?? null,
      hero_title_size_desktop: (data as any).hero_title_size_desktop ?? "4rem",
      hero_title_size_mobile: (data as any).hero_title_size_mobile ?? "2rem",
      show_nationality_on_jobs: (data as any).show_nationality_on_jobs ?? false,
    });
  };

  const set = (k: keyof Settings, v: any) => settings && setSettings({ ...settings, [k]: v });

  const handleLogoUpload = async (file: File) => {
    if (!settings) return;
    if (file.size > MAX_INLINE_IMAGE_SIZE) {
      toast.error(ar ? "الصورة كبيرة جداً (حد أقصى 4MB)" : "Image too large (max 4MB)");
      return;
    }
    setUploading(true);
    try {
      const url = await readImageAsDataUrl(file);
      set("logo_url", url);
      toast.success(ar ? "تم تجهيز الشعار" : "Logo ready");
    } catch {
      toast.error(ar ? "فشل رفع الشعار" : "Logo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeLogoBg = async (mode: "transparent" | "white") => {
    if (!settings?.logo_url) {
      toast.error(ar ? "ارفع الشعار أولاً" : "Upload a logo first");
      return;
    }
    setRemovingBg(mode);
    try {
      const { data, error } = await supabase.functions.invoke("remove-logo-bg", {
        body: { imageUrl: settings.logo_url, mode },
      });
      if (error) throw error;
      if (data?.imageUrl) {
        set("logo_url", data.imageUrl);
        toast.success(ar ? "تمت إزالة الخلفية" : "Background removed");
      } else {
        throw new Error("No image returned");
      }
    } catch (e: any) {
      toast.error((ar ? "فشل: " : "Failed: ") + (e.message || ""));
    } finally {
      setRemovingBg(null);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, ...rest } = settings;
    const { error } = await supabase.from("site_settings").update(rest as any).eq("id", id);
    if (error) toast.error(error.message);
    else { invalidateSiteSettingsCache(); refreshSiteLogo(); toast.success(ar ? "تم حفظ الإعدادات" : "Settings saved"); }
    setSaving(false);
  };

  if (!settings) return null;

  const logoH = parseInt(settings.logo_height) || 56;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5" />
          <h3 className="text-lg font-bold">{ar ? "تخصيص الهوية البصرية" : "Branding Settings"}</h3>
        </div>
        <Button onClick={saveSettings} disabled={saving} className="gradient-accent text-accent-foreground gap-2">
          <Save className="w-4 h-4" />
          {saving ? "..." : (ar ? "حفظ كل الإعدادات" : "Save All Settings")}
        </Button>
      </div>

      {/* Logo Upload + AI Background Removal */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="font-medium">{ar ? "الشعار الرئيسي" : "Main Logo"}</Label>
          <div className="flex items-center gap-4 flex-wrap">
            <div
              className="rounded border bg-muted/30 flex items-center justify-center p-3"
              style={{
                background: settings.logo_bg_color || (settings.logo_bg_enabled ? "#ffffff" : "transparent"),
                minWidth: 100, minHeight: 80,
              }}
            >
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-16 w-auto object-contain" />
              ) : (
                <span className="text-muted-foreground text-xs">{ar ? "لا شعار" : "No logo"}</span>
              )}
            </div>
            <div className="flex-1 space-y-2 min-w-[200px]">
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
                  <Upload className="w-4 h-4" />
                  {uploading ? "..." : (ar ? "رفع شعار" : "Upload logo")}
                </Button>
                {settings.logo_url && (
                  <Button variant="ghost" size="sm" onClick={() => set("logo_url", null)} className="text-destructive">
                    {ar ? "إزالة" : "Remove"}
                  </Button>
                )}
              </div>
              {settings.logo_url && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button variant="secondary" size="sm" onClick={() => removeLogoBg("transparent")}
                    disabled={!!removingBg} className="gap-2">
                    <Wand2 className="w-4 h-4" />
                    {removingBg === "transparent" ? (ar ? "جاري..." : "Processing...") : (ar ? "إزالة الخلفية (شفافة)" : "Remove BG (transparent)")}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => removeLogoBg("white")}
                    disabled={!!removingBg} className="gap-2">
                    <Wand2 className="w-4 h-4" />
                    {removingBg === "white" ? (ar ? "جاري..." : "Processing...") : (ar ? "خلفية بيضاء" : "White BG")}
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {ar ? "💡 الذكاء الاصطناعي يكتشف العناصر الرئيسية ويزيل الخلفية تلقائياً." : "💡 AI detects main elements and removes the background automatically."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo Size & Position */}
      <Card>
        <CardContent className="p-4 space-y-5">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4" />
            <Label className="font-medium">{ar ? "حجم الشعار وموضعه" : "Logo Size & Position"}</Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "الارتفاع" : "Height"}: {logoH}px</Label>
              <Slider value={[logoH]} min={24} max={160} step={2}
                onValueChange={([v]) => set("logo_height", String(v))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">
                {ar ? "العرض" : "Width"}: {settings.logo_width ? `${settings.logo_width}px` : (ar ? "تلقائي" : "Auto")}
              </Label>
              <div className="flex gap-2 items-center">
                <Slider value={[settings.logo_width ?? 0]} min={0} max={400} step={4}
                  onValueChange={([v]) => set("logo_width", v === 0 ? null : v)} />
                <Button variant="ghost" size="sm" onClick={() => set("logo_width", null)} title={ar ? "تلقائي" : "Auto"}>
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "إزاحة أفقية (X)" : "Offset X"}: {settings.logo_offset_x}px</Label>
              <Slider value={[settings.logo_offset_x]} min={-100} max={100} step={1}
                onValueChange={([v]) => set("logo_offset_x", v)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "إزاحة عمودية (Y)" : "Offset Y"}: {settings.logo_offset_y}px</Label>
              <Slider value={[settings.logo_offset_y]} min={-50} max={50} step={1}
                onValueChange={([v]) => set("logo_offset_y", v)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "تدوير" : "Rotation"}: {settings.logo_rotation}°</Label>
              <Slider value={[settings.logo_rotation]} min={-180} max={180} step={1}
                onValueChange={([v]) => set("logo_rotation", v)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "محاذاة" : "Alignment"}</Label>
              <Select value={settings.logo_alignment} onValueChange={v => set("logo_alignment", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="start">{ar ? "بداية" : "Start"}</SelectItem>
                  <SelectItem value="center">{ar ? "وسط" : "Center"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "احتواء الصورة" : "Object Fit"}</Label>
              <Select value={settings.logo_fit} onValueChange={v => set("logo_fit", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contain">Contain</SelectItem>
                  <SelectItem value="cover">Cover</SelectItem>
                  <SelectItem value="fill">Fill</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo Decoration */}
      <Card>
        <CardContent className="p-4 space-y-5">
          <Label className="font-medium">{ar ? "زخرفة الشعار" : "Logo Decoration"}</Label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "الحشو الداخلي" : "Padding"}: {settings.logo_padding}px</Label>
              <Slider value={[settings.logo_padding]} min={0} max={32} step={1}
                onValueChange={([v]) => set("logo_padding", v)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "استدارة الزوايا" : "Border Radius"}: {settings.logo_border_radius}px</Label>
              <Slider value={[parseInt(settings.logo_border_radius) || 0]} min={0} max={40} step={1}
                onValueChange={([v]) => set("logo_border_radius", String(v))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "لون خلفية الشعار" : "Logo Background Color"}</Label>
              <div className="flex gap-2">
                <Input type="color" value={settings.logo_bg_color || "#ffffff"}
                  onChange={(e) => set("logo_bg_color", e.target.value)} className="w-14 p-1 h-10" />
                <Input value={settings.logo_bg_color || ""}
                  placeholder={ar ? "اتركه فارغاً للافتراضي" : "Leave blank for default"}
                  onChange={(e) => set("logo_bg_color", e.target.value || null)} dir="ltr" />
                {settings.logo_bg_color && (
                  <Button variant="ghost" size="sm" onClick={() => set("logo_bg_color", null)}>
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2 pt-6">
              <label className="flex items-center justify-between gap-2 text-sm">
                <span>{ar ? "خلفية شفافة افتراضية" : "Default Translucent BG"}</span>
                <Switch checked={settings.logo_bg_enabled} onCheckedChange={v => set("logo_bg_enabled", v)} />
              </label>
              <label className="flex items-center justify-between gap-2 text-sm">
                <span>{ar ? "ظل" : "Shadow"}</span>
                <Switch checked={settings.logo_shadow} onCheckedChange={v => set("logo_shadow", v)} />
              </label>
              <label className="flex items-center justify-between gap-2 text-sm">
                <span>{ar ? "إطار" : "Border"}</span>
                <Switch checked={settings.logo_border} onCheckedChange={v => set("logo_border", v)} />
              </label>
            </div>
          </div>

          {/* Live Preview */}
          {settings.logo_url && (
            <div className="mt-3 p-6 rounded-lg border bg-gradient-to-br from-primary to-accent">
              <p className="text-xs text-primary-foreground/80 mb-3">{ar ? "معاينة على خلفية ملوّنة" : "Preview on colored background"}</p>
              <div className={`flex ${settings.logo_alignment === "center" ? "justify-center" : "justify-start"}`}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: `${settings.logo_padding}px`,
                    borderRadius: `${parseInt(settings.logo_border_radius) || 0}px`,
                    background: settings.logo_bg_color
                      ? settings.logo_bg_color
                      : (settings.logo_bg_enabled ? "rgba(255,255,255,0.85)" : "transparent"),
                    boxShadow: settings.logo_shadow ? "0 8px 24px -8px rgba(0,0,0,0.5)" : undefined,
                    border: settings.logo_border ? "1px solid rgba(255,255,255,0.4)" : undefined,
                    transform: `translate(${settings.logo_offset_x}px, ${settings.logo_offset_y}px) rotate(${settings.logo_rotation}deg)`,
                  }}
                >
                  <img src={settings.logo_url} alt="Preview"
                    style={{
                      height: `${logoH}px`,
                      width: settings.logo_width ? `${settings.logo_width}px` : "auto",
                      objectFit: settings.logo_fit as any,
                      display: "block",
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Site Name */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="font-medium">{ar ? "اسم الموقع" : "Site Name"}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "عربي" : "Arabic"}</Label>
              <Input value={settings.site_name_ar} onChange={(e) => set("site_name_ar", e.target.value)} dir="rtl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "إنجليزي" : "English"}</Label>
              <Input value={settings.site_name_en} onChange={(e) => set("site_name_en", e.target.value)} dir="ltr" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="font-medium">{ar ? "الألوان" : "Colors"}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "اللون الرئيسي" : "Primary"}</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={settings.primary_color}
                  onChange={(e) => set("primary_color", e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer" />
                <Input value={settings.primary_color} onChange={(e) => set("primary_color", e.target.value)} dir="ltr" className="w-32" />
                <div className="h-10 flex-1 rounded" style={{ background: settings.primary_color }} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "اللون الثانوي" : "Accent"}</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={settings.accent_color}
                  onChange={(e) => set("accent_color", e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer" />
                <Input value={settings.accent_color} onChange={(e) => set("accent_color", e.target.value)} dir="ltr" className="w-32" />
                <div className="h-10 flex-1 rounded" style={{ background: settings.accent_color }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Page Options */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4" />
            <Label className="font-medium">{ar ? "إعدادات صفحة الشواغر" : "Jobs Page Options"}</Label>
          </div>
          <label className="flex items-center justify-between gap-2 text-sm">
            <div>
              <p>{ar ? "إظهار الجنسية المطلوبة في إعلانات الوظائف" : "Show required nationality on job listings"}</p>
              <p className="text-xs text-muted-foreground">
                {ar ? "إذا تم إيقافه، لن تظهر الجنسية في صفحة الشواغر ولا تفاصيل الوظيفة." : "When off, nationality is hidden on jobs and detail pages."}
              </p>
            </div>
            <Switch checked={settings.show_nationality_on_jobs}
              onCheckedChange={v => set("show_nationality_on_jobs", v)} />
          </label>
        </CardContent>
      </Card>

      {/* Mobile Logo Overrides */}
      <Card>
        <CardContent className="p-4 space-y-5">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4" />
            <Label className="font-medium">{ar ? "📱 إعدادات الجوال (اختياري)" : "📱 Mobile Overrides (optional)"}</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {ar ? "اتركها فارغة لاستخدام إعدادات الكمبيوتر تلقائياً. هذه القيم تطبق على شاشات أقل من 768px." : "Leave blank to inherit from desktop. Applied on screens smaller than 768px."}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-xs">
                {ar ? "ارتفاع اللوقو على الجوال" : "Mobile Logo Height"}: {settings.logo_height_mobile ? `${settings.logo_height_mobile}px` : (ar ? "تلقائي" : "Auto")}
              </Label>
              <div className="flex gap-2 items-center">
                <Slider value={[settings.logo_height_mobile ?? 0]} min={0} max={120} step={2}
                  onValueChange={([v]) => set("logo_height_mobile", v === 0 ? null : v)} />
                <Button variant="ghost" size="sm" onClick={() => set("logo_height_mobile", null)}>
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">
                {ar ? "عرض اللوقو على الجوال" : "Mobile Logo Width"}: {settings.logo_width_mobile ? `${settings.logo_width_mobile}px` : (ar ? "تلقائي" : "Auto")}
              </Label>
              <div className="flex gap-2 items-center">
                <Slider value={[settings.logo_width_mobile ?? 0]} min={0} max={300} step={2}
                  onValueChange={([v]) => set("logo_width_mobile", v === 0 ? null : v)} />
                <Button variant="ghost" size="sm" onClick={() => set("logo_width_mobile", null)}>
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">
                {ar ? "حشو داخلي للجوال" : "Mobile Padding"}: {settings.logo_padding_mobile ?? "—"}px
              </Label>
              <div className="flex gap-2 items-center">
                <Slider value={[settings.logo_padding_mobile ?? 0]} min={0} max={32} step={1}
                  onValueChange={([v]) => set("logo_padding_mobile", v)} />
                <Button variant="ghost" size="sm" onClick={() => set("logo_padding_mobile", null)}>
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "خلفية اللوقو للجوال" : "Mobile Logo BG Color"}</Label>
              <div className="flex gap-2">
                <Input type="color" value={settings.logo_bg_color_mobile || "#ffffff"}
                  onChange={(e) => set("logo_bg_color_mobile", e.target.value)} className="w-14 p-1 h-10" />
                <Input value={settings.logo_bg_color_mobile || ""}
                  placeholder={ar ? "اتركه فارغاً" : "Leave blank"}
                  onChange={(e) => set("logo_bg_color_mobile", e.target.value || null)} dir="ltr" />
                {settings.logo_bg_color_mobile && (
                  <Button variant="ghost" size="sm" onClick={() => set("logo_bg_color_mobile", null)}>
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Background Colors */}
      <Card>
        <CardContent className="p-4 space-y-5">
          <Label className="font-medium">{ar ? "🎨 ألوان خلفية الأقسام" : "🎨 Section Background Colors"}</Label>
          <p className="text-xs text-muted-foreground">
            {ar ? "اتركها فارغة لاستخدام التدرّج الافتراضي للهوية." : "Leave blank to use the default brand gradient."}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {([
              { key: "hero_bg_color", labelAr: "قسم الهيرو (كمبيوتر)", labelEn: "Hero Section (Desktop)" },
              { key: "hero_bg_color_mobile", labelAr: "قسم الهيرو (جوال)", labelEn: "Hero Section (Mobile)" },
              { key: "features_bg_color", labelAr: "قسم المزايا", labelEn: "Features Section" },
              { key: "stats_bg_color", labelAr: "قسم الإحصائيات", labelEn: "Stats Section" },
              { key: "cta_bg_color", labelAr: "قسم الدعوة للعمل", labelEn: "CTA Section" },
            ] as const).map(({ key, labelAr, labelEn }) => (
              <div key={key} className="space-y-2">
                <Label className="text-xs">{ar ? labelAr : labelEn}</Label>
                <div className="flex gap-2">
                  <Input type="color" value={(settings as any)[key] || "#ffffff"}
                    onChange={(e) => set(key as any, e.target.value)} className="w-14 p-1 h-10" />
                  <Input value={(settings as any)[key] || ""}
                    placeholder={ar ? "افتراضي" : "Default"}
                    onChange={(e) => set(key as any, e.target.value || null)} dir="ltr" />
                  {(settings as any)[key] && (
                    <Button variant="ghost" size="sm" onClick={() => set(key as any, null)}>
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hero Title Size */}
      <Card>
        <CardContent className="p-4 space-y-5">
          <Label className="font-medium">{ar ? "🅰️ حجم عنوان الهيرو" : "🅰️ Hero Title Size"}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "كمبيوتر / تابلت" : "Desktop / Tablet"}</Label>
              <Input value={settings.hero_title_size_desktop || ""} placeholder="4rem"
                onChange={(e) => set("hero_title_size_desktop", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{ar ? "جوال" : "Mobile"}</Label>
              <Input value={settings.hero_title_size_mobile || ""} placeholder="2rem"
                onChange={(e) => set("hero_title_size_mobile", e.target.value)} dir="ltr" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving} className="gradient-accent text-accent-foreground gap-2">
          <Save className="w-4 h-4" />
          {saving ? "..." : (ar ? "حفظ كل الإعدادات" : "Save All Settings")}
        </Button>
      </div>
    </div>
  );
};

export default BrandingSettings;
