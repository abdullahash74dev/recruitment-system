import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Save, Upload, Image as ImageIcon, Type, Palette, Briefcase } from "lucide-react";
import { invalidateSiteSettingsCache } from "@/hooks/useSiteSettings";
import { MAX_INLINE_IMAGE_SIZE, readImageAsDataUrl } from "@/lib/imageUpload";
import ProjectLogo from "@/components/ProjectLogo";

const JobPageSettings = () => {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [s, setS] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("site_settings").select("*").limit(1).single().then(({ data }) => {
      if (data) setS(data);
    });
  }, []);

  const set = (k: string, v: any) => setS((p: any) => ({ ...p, [k]: v }));

  const upload = async (file: File) => {
    if (file.size > MAX_INLINE_IMAGE_SIZE) {
      toast.error(ar ? "الحجم يجب أن يكون أقل من 4 ميجابايت" : "Max 4 MB");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await readImageAsDataUrl(file);
      set("job_page_logo_url", dataUrl);
    } catch {
      toast.error(ar ? "فشل قراءة الصورة" : "Failed to read image");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { id, created_at, updated_at, ...rest } = s;
    const { error } = await supabase.from("site_settings").update(rest as any).eq("id", id);
    if (error) toast.error(error.message);
    else { invalidateSiteSettingsCache(); toast.success(ar ? "تم الحفظ" : "Saved"); }
    setSaving(false);
  };

  if (!s) return null;

  const F = ({ label, k, ltr = false, multiline = false }: { label: string; k: string; ltr?: boolean; multiline?: boolean }) => (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      {multiline ? (
        <Textarea value={s[k] || ""} onChange={(e) => set(k, e.target.value)} dir={ltr ? "ltr" : "rtl"} rows={2} />
      ) : (
        <Input value={s[k] || ""} onChange={(e) => set(k, e.target.value)} dir={ltr ? "ltr" : "rtl"} />
      )}
    </div>
  );

  const Color = ({ label, k, fallback = "" }: { label: string; k: string; fallback?: string }) => (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-2">
        <Input
          type="color"
          value={s[k] || fallback || "#ffffff"}
          onChange={(e) => set(k, e.target.value)}
          className="w-14 p-1 h-10"
        />
        <Input
          value={s[k] || ""}
          onChange={(e) => set(k, e.target.value)}
          placeholder={ar ? "اتركه فارغاً للوضع الافتراضي" : "Leave empty for default"}
          dir="ltr"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5" />
          <h3 className="text-lg font-bold">{ar ? "تخصيص صفحة الوظيفة" : "Job Page Customization"}</h3>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? (ar ? "جارٍ الحفظ..." : "Saving...") : (ar ? "حفظ كل التغييرات" : "Save All Changes")}
        </Button>
      </div>

      {/* GROUPING & SECTIONS */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h4 className="font-semibold text-sm text-accent flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            {ar ? "تجميع الوظائف وأقسام العرض" : "Grouping & Sections"}
          </h4>
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20">
              <div>
                <div className="font-medium text-sm">{ar ? "تجميع الوظائف حسب المنطقة" : "Group jobs by location"}</div>
                <div className="text-xs text-muted-foreground">{ar ? "يتم تقسيم الوظائف تلقائياً (الرياض، الشرقية، جدة...)" : "Splits jobs automatically by their location field"}</div>
              </div>
              <Switch checked={!!s.jobs_group_by_location} onCheckedChange={(v) => set("jobs_group_by_location", v)} />
            </label>
            <label className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20">
              <div>
                <div className="font-medium text-sm">{ar ? "عرض الوظائف المكتملة (المُغلقة)" : "Show completed (closed) jobs"}</div>
                <div className="text-xs text-muted-foreground">{ar ? "تظهر في قسم منفصل بشكل مميز" : "Shown in a separate, dimmed section"}</div>
              </div>
              <Switch checked={!!s.jobs_show_completed} onCheckedChange={(v) => set("jobs_show_completed", v)} />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <F label={ar ? "بادئة عنوان القسم (عربي) مثل: وظائف" : "Section prefix (AR) e.g. وظائف"} k="jobs_section_title_ar" />
            <F label={ar ? "بادئة عنوان القسم (إنجليزي) مثل: Jobs in" : "Section prefix (EN) e.g. Jobs in"} k="jobs_section_title_en" ltr />
            <F label={ar ? "عنوان قسم المكتملة (عربي)" : "Completed label (AR)"} k="jobs_completed_label_ar" />
            <F label={ar ? "عنوان قسم المكتملة (إنجليزي)" : "Completed label (EN)"} k="jobs_completed_label_en" ltr />
            <F label={ar ? "اسم المناطق غير المحددة (عربي)" : "Other-locations label (AR)"} k="jobs_other_label_ar" />
            <F label={ar ? "اسم المناطق غير المحددة (إنجليزي)" : "Other-locations label (EN)"} k="jobs_other_label_en" ltr />
          </div>
        </CardContent>
      </Card>



      {/* LOGO + BRAND */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h4 className="font-semibold text-sm text-accent flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            {ar ? "الشعار العلوي" : "Top Logo"}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 items-start">
            <div className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-muted/20">
              <ProjectLogo
                path={s.job_page_logo_url}
                height={s.job_page_logo_height || 40}
                radius={s.job_page_logo_radius}
                padding={s.job_page_logo_padding}
                bgColor={s.job_page_logo_bg_color}
                shadow={s.job_page_logo_shadow}
                border={s.job_page_logo_border}
                fit="contain"
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1">
                <Upload className="w-3 h-3" />
                {uploading ? "..." : ar ? "رفع شعار" : "Upload"}
              </Button>
              {s.job_page_logo_url && (
                <Button size="sm" variant="ghost" onClick={() => set("job_page_logo_url", null)} className="text-destructive">
                  {ar ? "إزالة" : "Remove"}
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">{ar ? "الارتفاع" : "Height"}: {s.job_page_logo_height || 40}px</Label>
                <Slider value={[s.job_page_logo_height || 40]} min={24} max={120} step={2} onValueChange={(v) => set("job_page_logo_height", v[0])} />
              </div>
              <div>
                <Label className="text-xs">{ar ? "تدوير الزوايا" : "Border Radius"}: {s.job_page_logo_radius || 0}px</Label>
                <Slider value={[s.job_page_logo_radius || 0]} min={0} max={48} step={1} onValueChange={(v) => set("job_page_logo_radius", v[0])} />
              </div>
              <div>
                <Label className="text-xs">{ar ? "الحشو الداخلي" : "Padding"}: {s.job_page_logo_padding || 0}px</Label>
                <Slider value={[s.job_page_logo_padding || 0]} min={0} max={24} step={1} onValueChange={(v) => set("job_page_logo_padding", v[0])} />
              </div>
              <Color label={ar ? "خلفية الشعار" : "Logo Background"} k="job_page_logo_bg_color" />
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!s.job_page_logo_shadow} onCheckedChange={(v) => set("job_page_logo_shadow", v)} />
                  {ar ? "ظل" : "Shadow"}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!s.job_page_logo_border} onCheckedChange={(v) => set("job_page_logo_border", v)} />
                  {ar ? "إطار" : "Border"}
                </label>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label={ar ? "النص بجانب الشعار (عربي)" : "Brand text (AR)"} k="job_page_brand_text_ar" />
            <F label={ar ? "النص بجانب الشعار (إنجليزي)" : "Brand text (EN)"} k="job_page_brand_text_en" ltr />
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <Switch checked={!!s.job_page_show_brand_text} onCheckedChange={(v) => set("job_page_show_brand_text", v)} />
              {ar ? "إظهار النص بجانب الشعار" : "Show brand text next to logo"}
            </label>
          </div>
        </CardContent>
      </Card>

      {/* SECTION TITLES */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h4 className="font-semibold text-sm text-accent flex items-center gap-2">
            <Type className="w-4 h-4" />
            {ar ? "عناوين الأقسام" : "Section Titles"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label={ar ? "عنوان الوصف الوظيفي (عربي)" : "Description title (AR)"} k="job_page_description_title_ar" />
            <F label={ar ? "عنوان الوصف الوظيفي (إنجليزي)" : "Description title (EN)"} k="job_page_description_title_en" ltr />
            <F label={ar ? "عنوان المتطلبات (عربي)" : "Requirements title (AR)"} k="job_page_requirements_title_ar" />
            <F label={ar ? "عنوان المتطلبات (إنجليزي)" : "Requirements title (EN)"} k="job_page_requirements_title_en" ltr />
            <F label={ar ? "عنوان التفاصيل الإضافية (عربي)" : "Additional title (AR)"} k="job_page_additional_title_ar" />
            <F label={ar ? "عنوان التفاصيل الإضافية (إنجليزي)" : "Additional title (EN)"} k="job_page_additional_title_en" ltr />
          </div>
        </CardContent>
      </Card>

      {/* APPLY SIDEBAR */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h4 className="font-semibold text-sm text-accent flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            {ar ? "بطاقة التقديم الجانبية" : "Apply Sidebar Card"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label={ar ? "العنوان (عربي)" : "Title (AR)"} k="job_page_apply_title_ar" />
            <F label={ar ? "العنوان (إنجليزي)" : "Title (EN)"} k="job_page_apply_title_en" ltr />
            <F label={ar ? "الوصف (عربي)" : "Description (AR)"} k="job_page_apply_desc_ar" multiline />
            <F label={ar ? "الوصف (إنجليزي)" : "Description (EN)"} k="job_page_apply_desc_en" ltr multiline />
            <F label={ar ? "نص الزر (عربي)" : "Button text (AR)"} k="job_page_apply_btn_ar" />
            <F label={ar ? "نص الزر (إنجليزي)" : "Button text (EN)"} k="job_page_apply_btn_en" ltr />
          </div>
        </CardContent>
      </Card>

      {/* COLORS */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h4 className="font-semibold text-sm text-accent flex items-center gap-2">
            <Palette className="w-4 h-4" />
            {ar ? "الألوان والتنسيق" : "Colors & Styling"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Color label={ar ? "خلفية القسم العلوي (Hero)" : "Hero background"} k="job_page_hero_bg" />
            <Color label={ar ? "خلفية البطاقات" : "Card background"} k="job_page_card_bg" />
            <Color label={ar ? "لون حدود البطاقات" : "Card border color"} k="job_page_card_border_color" />
            <Color label={ar ? "لون الأيقونات" : "Icons color"} k="job_page_icon_color" />
            <Color label={ar ? "خلفية زر التقديم" : "Apply button background"} k="job_page_apply_btn_bg" />
            <Color label={ar ? "لون نص زر التقديم" : "Apply button text"} k="job_page_apply_btn_text_color" />
            <div className="md:col-span-2">
              <Label className="text-xs">{ar ? "تدوير زوايا البطاقات" : "Card border radius"}: {s.job_page_card_radius ?? 12}px</Label>
              <Slider value={[s.job_page_card_radius ?? 12]} min={0} max={32} step={1} onValueChange={(v) => set("job_page_card_radius", v[0])} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? (ar ? "جارٍ الحفظ..." : "Saving...") : (ar ? "حفظ كل التغييرات" : "Save All Changes")}
        </Button>
      </div>
    </div>
  );
};

export default JobPageSettings;
