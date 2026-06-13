import { Moon, Sun, Globe, Palette, Check, Sparkles, Wand2, PanelLeft, Rows3, Atom } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useTheme, PALETTE_LABELS, ICON_STYLE_LABELS, NAV_STYLE_LABELS,
  type ThemePalette, type IconStyle, type CustomThemeColors, type NavStyle,
} from "@/contexts/ThemeContext";

interface TopBarProps { variant?: "light" | "dark"; allowCustomization?: boolean; }

const TopBar = ({ variant = "dark", allowCustomization = false }: TopBarProps) => {
  const { lang, setLang } = useLanguage();
  const { theme, toggleTheme, palette, setPalette, iconStyle, setIconStyle, customTheme, setCustomTheme, animatedBg, setAnimatedBg, navStyle, setNavStyle } = useTheme();
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<CustomThemeColors>(customTheme);

  const colorClass = variant === "light"
    ? "text-primary-foreground hover:bg-white/10"
    : "text-foreground hover:bg-muted";

  const palettes = Object.keys(PALETTE_LABELS) as ThemePalette[];
  const iconStyles = Object.keys(ICON_STYLE_LABELS) as IconStyle[];
  const navStyles = Object.keys(NAV_STYLE_LABELS) as NavStyle[];

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => setLang(lang === "ar" ? "en" : "ar")} className={colorClass} title={lang === "ar" ? "English" : "العربية"}>
        <Globe className="w-5 h-5" />
      </Button>

      {allowCustomization && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={colorClass} title={lang === "ar" ? "ثيمات الألوان" : "Color themes"}>
              <Palette className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>{lang === "ar" ? "اختر ثيم اللوحة" : "Choose theme"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {palettes.map((p) => {
              const meta = PALETTE_LABELS[p];
              const active = palette === p;
              const colors = p === "custom" ? [customTheme.primary, customTheme.accent] : meta.swatch;
              return (
                <DropdownMenuItem key={p} onClick={() => p === "custom" ? (setCustomDraft(customTheme), setCustomOpen(true)) : setPalette(p)} className="flex items-center gap-2 cursor-pointer">
                  <span
                    className="w-8 h-5 rounded-md border border-border shrink-0"
                    style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
                  />
                  <span className="flex-1 text-sm">{lang === "ar" ? meta.ar : meta.en}</span>
                  {active && <Check className="w-4 h-4 text-accent" />}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Wand2 className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="animated-bg-toggle" className="flex-1 text-sm cursor-pointer">
                {lang === "ar" ? "خلفية متدرجة متحركة" : "Animated gradient background"}
              </Label>
              <Switch id="animated-bg-toggle" checked={animatedBg} onCheckedChange={setAnimatedBg} />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {allowCustomization && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={colorClass} title={lang === "ar" ? "شكل الأيقونات" : "Icon style"}>
              <Sparkles className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>{lang === "ar" ? "شكل الأيقونات" : "Icon style"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {iconStyles.map((s) => (
              <DropdownMenuItem key={s} onClick={() => setIconStyle(s)} className="flex items-center gap-2 cursor-pointer">
                <span className={`icons-${s} inline-flex`}>
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="flex-1 text-sm">{lang === "ar" ? ICON_STYLE_LABELS[s].ar : ICON_STYLE_LABELS[s].en}</span>
                {iconStyle === s && <Check className="w-4 h-4 text-accent" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {allowCustomization && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={colorClass} title={lang === "ar" ? "نمط التنقل في اللوحة" : "Dashboard navigation style"}>
              {navStyle === "modern" ? <PanelLeft className="w-5 h-5" /> : navStyle === "futuristic" ? <Atom className="w-5 h-5" /> : <Rows3 className="w-5 h-5" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>{lang === "ar" ? "نمط التنقل في اللوحة" : "Dashboard navigation style"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {navStyles.map((s) => (
              <DropdownMenuItem key={s} onClick={() => setNavStyle(s)} className="flex items-center gap-2 cursor-pointer">
                {s === "modern" ? <PanelLeft className="w-4 h-4" /> : s === "futuristic" ? <Atom className="w-4 h-4" /> : <Rows3 className="w-4 h-4" />}
                <span className="flex-1 text-sm">{lang === "ar" ? NAV_STYLE_LABELS[s].ar : NAV_STYLE_LABELS[s].en}</span>
                {navStyle === s && <Check className="w-4 h-4 text-accent" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button variant="ghost" size="icon" onClick={toggleTheme} className={colorClass} title={theme === "light" ? "Dark Mode" : "Light Mode"}>
        {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </Button>

      <Dialog open={allowCustomization && customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="max-w-sm" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "تخصيص الثيم" : "Customize theme"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(["primary", "accent", "background", "card"] as (keyof CustomThemeColors)[]).map((key) => (
              <div key={key} className="grid grid-cols-[1fr_64px] items-center gap-3">
                <Label>{lang === "ar" ? ({ primary: "اللون الأساسي", accent: "لون التمييز", background: "الخلفية", card: "البطاقات" }[key]) : key}</Label>
                <Input type="color" value={customDraft[key]} onChange={(e) => setCustomDraft((p) => ({ ...p, [key]: e.target.value }))} className="h-10 p-1" />
              </div>
            ))}
            <div className="rounded-lg border p-4" style={{ background: customDraft.background }}>
              <div className="rounded-md p-3 text-white" style={{ background: `linear-gradient(135deg, ${customDraft.primary}, ${customDraft.accent})` }}>
                {lang === "ar" ? "معاينة الثيم" : "Theme preview"}
              </div>
            </div>
            <Button className="w-full gradient-primary text-primary-foreground" onClick={() => { setCustomTheme(customDraft); setCustomOpen(false); }}>
              {lang === "ar" ? "تطبيق الثيم الخاص" : "Apply custom theme"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TopBar;
