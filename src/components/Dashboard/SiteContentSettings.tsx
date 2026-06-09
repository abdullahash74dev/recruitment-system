import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, Type, BarChart3, Sparkles } from "lucide-react";
import { invalidateSiteSettingsCache } from "@/hooks/useSiteSettings";

const SiteContentSettings = () => {
  const { lang } = useLanguage();
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("site_settings").select("*").limit(1).single().then(({ data }) => {
      if (data) setSettings(data);
    });
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, created_at, updated_at, ...rest } = settings;
    const { error } = await supabase.from("site_settings").update(rest as any).eq("id", id);
    if (error) toast.error(error.message);
    else { invalidateSiteSettingsCache(); toast.success(lang === "ar" ? "تم الحفظ" : "Saved"); }
    setSaving(false);
  };

  const f = (key: string, val: string) => setSettings((p: any) => ({ ...p, [key]: val }));

  if (!settings) return null;

  const Field = ({ label, k, dir: d = "rtl", multiline = false }: { label: string; k: string; dir?: string; multiline?: boolean }) => (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      {multiline ? (
        <Textarea value={settings[k] || ""} onChange={e => f(k, e.target.value)} dir={d} rows={2} />
      ) : (
        <Input value={settings[k] || ""} onChange={e => f(k, e.target.value)} dir={d} />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Type className="w-5 h-5" />
        <h3 className="text-lg font-bold">{lang === "ar" ? "تعديل محتوى الموقع" : "Edit Site Content"}</h3>
      </div>

      {/* Hero Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h4 className="font-semibold text-sm text-accent">{lang === "ar" ? "قسم البطل (Hero)" : "Hero Section"}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={lang === "ar" ? "العنوان السطر 1 (عربي)" : "Title Line 1 (AR)"} k="hero_title1_ar" />
            <Field label={lang === "ar" ? "العنوان السطر 1 (إنجليزي)" : "Title Line 1 (EN)"} k="hero_title1_en" dir="ltr" />
            <Field label={lang === "ar" ? "العنوان السطر 2 (عربي)" : "Title Line 2 (AR)"} k="hero_title2_ar" />
            <Field label={lang === "ar" ? "العنوان السطر 2 (إنجليزي)" : "Title Line 2 (EN)"} k="hero_title2_en" dir="ltr" />
            <Field label={lang === "ar" ? "الوصف (عربي)" : "Description (AR)"} k="hero_desc_ar" multiline />
            <Field label={lang === "ar" ? "الوصف (إنجليزي)" : "Description (EN)"} k="hero_desc_en" dir="ltr" multiline />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-accent flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              {lang === "ar" ? "قسم الأرقام والإحصائيات" : "Stats Section"}
            </h4>
            <div className="flex items-center gap-2">
              <Switch checked={settings.show_stats_section} onCheckedChange={v => setSettings((p: any) => ({ ...p, show_stats_section: v }))} />
              <Label className="text-xs">{lang === "ar" ? "إظهار" : "Show"}</Label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={lang === "ar" ? "عنوان القسم (عربي)" : "Section Title (AR)"} k="stats_section_title_ar" />
            <Field label={lang === "ar" ? "عنوان القسم (إنجليزي)" : "Section Title (EN)"} k="stats_section_title_en" dir="ltr" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={lang === "ar" ? "عدد الموظفين" : "Employee Count"} k="employee_count" dir="ltr" />
            <Field label={lang === "ar" ? "سنة التأسيس" : "Founding Year"} k="founding_year" dir="ltr" />
            <Field label={lang === "ar" ? "عدد المشاريع" : "Projects Count"} k="projects_count" dir="ltr" />
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h4 className="font-semibold text-sm text-accent flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {lang === "ar" ? "قسم المميزات" : "Features Section"}
          </h4>
          {[1, 2, 3].map(i => (
            <div key={i} className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">{lang === "ar" ? `الميزة ${i}` : `Feature ${i}`}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={lang === "ar" ? "العنوان (عربي)" : "Title (AR)"} k={`feature${i}_title_ar`} />
                <Field label={lang === "ar" ? "العنوان (إنجليزي)" : "Title (EN)"} k={`feature${i}_title_en`} dir="ltr" />
                <Field label={lang === "ar" ? "الوصف (عربي)" : "Desc (AR)"} k={`feature${i}_desc_ar`} multiline />
                <Field label={lang === "ar" ? "الوصف (إنجليزي)" : "Desc (EN)"} k={`feature${i}_desc_en`} dir="ltr" multiline />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Apply Page Text */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h4 className="font-semibold text-sm text-accent">{lang === "ar" ? "صفحة التقديم" : "Apply Page"}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={lang === "ar" ? "عنوان صفحة التقديم (عربي)" : "Apply Page Title (AR)"} k="apply_title_ar" />
            <Field label={lang === "ar" ? "عنوان صفحة التقديم (إنجليزي)" : "Apply Page Title (EN)"} k="apply_title_en" dir="ltr" />
            <Field label={lang === "ar" ? "وصف صفحة التقديم (عربي)" : "Apply Page Desc (AR)"} k="apply_desc_ar" multiline />
            <Field label={lang === "ar" ? "وصف صفحة التقديم (إنجليزي)" : "Apply Page Desc (EN)"} k="apply_desc_en" dir="ltr" multiline />
          </div>
        </CardContent>
      </Card>

      {/* Success Screen */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h4 className="font-semibold text-sm text-accent">{lang === "ar" ? "شاشة نجاح التقديم" : "Submission Success Screen"}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={lang === "ar" ? "عنوان النجاح (عربي)" : "Success Title (AR)"} k="success_title_ar" />
            <Field label={lang === "ar" ? "عنوان النجاح (إنجليزي)" : "Success Title (EN)"} k="success_title_en" dir="ltr" />
            <Field label={lang === "ar" ? "وصف النجاح (عربي)" : "Success Desc (AR)"} k="success_desc_ar" multiline />
            <Field label={lang === "ar" ? "وصف النجاح (إنجليزي)" : "Success Desc (EN)"} k="success_desc_en" dir="ltr" multiline />
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h4 className="font-semibold text-sm text-accent">{lang === "ar" ? "قسم الدعوة للتقديم (CTA)" : "Call to Action"}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={lang === "ar" ? "العنوان (عربي)" : "Title (AR)"} k="cta_title_ar" />
            <Field label={lang === "ar" ? "العنوان (إنجليزي)" : "Title (EN)"} k="cta_title_en" dir="ltr" />
            <Field label={lang === "ar" ? "الوصف (عربي)" : "Desc (AR)"} k="cta_desc_ar" multiline />
            <Field label={lang === "ar" ? "الوصف (إنجليزي)" : "Desc (EN)"} k="cta_desc_en" dir="ltr" multiline />
          </div>
        </CardContent>
      </Card>

      {/* Projects section toggle */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">{lang === "ar" ? "إظهار قسم المشاريع في الصفحة الرئيسية" : "Show Projects Section on Homepage"}</h4>
            <Switch checked={settings.show_projects_section} onCheckedChange={v => setSettings((p: any) => ({ ...p, show_projects_section: v }))} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gradient-accent text-accent-foreground gap-2">
          <Save className="w-4 h-4" />
          {saving ? "..." : (lang === "ar" ? "حفظ المحتوى" : "Save Content")}
        </Button>
      </div>
    </div>
  );
};

export default SiteContentSettings;
