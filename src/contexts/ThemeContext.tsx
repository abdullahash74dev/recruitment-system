import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ThemeMode = "light" | "dark";
export type ThemePalette =
  | "default" | "midnight" | "emerald" | "rose" | "slate" | "sunset" | "ocean" | "noir" | "aurora" | "custom";
export type IconStyle = "regular" | "thin" | "bold" | "rounded" | "sharp";

export interface CustomThemeColors {
  primary: string;
  accent: string;
  background: string;
  card: string;
}

interface ThemeContextType {
  theme: ThemeMode;
  palette: ThemePalette;
  iconStyle: IconStyle;
  toggleTheme: () => void;
  setPalette: (p: ThemePalette) => void;
  setIconStyle: (s: IconStyle) => void;
  customTheme: CustomThemeColors;
  setCustomTheme: (colors: CustomThemeColors) => void;
  animatedBg: boolean;
  setAnimatedBg: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const PALETTES: ThemePalette[] = ["default", "midnight", "emerald", "rose", "slate", "sunset", "ocean", "noir", "aurora", "custom"];
const ICON_STYLES: IconStyle[] = ["regular", "thin", "bold", "rounded", "sharp"];

export const DEFAULT_CUSTOM_THEME: CustomThemeColors = {
  primary: "#3b82f6",
  accent: "#22d3ee",
  background: "#f8fafc",
  card: "#ffffff",
};

export const PALETTE_LABELS: Record<ThemePalette, { ar: string; en: string; swatch: string[] }> = {
  default:  { ar: "كوانتم الأزرق",     en: "Quantum Blue",     swatch: ["#3b82f6", "#22d3ee"] },
  midnight: { ar: "منتصف الليل",       en: "Midnight Indigo", swatch: ["#1e1b4b", "#4f46e5"] },
  emerald:  { ar: "الزمرد الفاخر",     en: "Emerald Prestige", swatch: ["#064e3b", "#c9a84c"] },
  rose:     { ar: "الورد والخزامى",   en: "Blush & Lavender", swatch: ["#9b72cf", "#e8c5d0"] },
  slate:    { ar: "الفولاذ المؤسسي",  en: "Slate & Steel",    swatch: ["#2d3748", "#718096"] },
  sunset:   { ar: "الغروب المتوهج",   en: "Sunset Blaze",     swatch: ["#ff6b35", "#e84393"] },
  ocean:    { ar: "أعماق المحيط",      en: "Ocean Deep",       swatch: ["#0c2340", "#2d8a9e"] },
  noir:     { ar: "الأسود الذهبي",     en: "Noir & Gold",      swatch: ["#0d0d0d", "#c9a84c"] },
  aurora:   { ar: "أورورا الذكاء",     en: "AI Aurora",        swatch: ["#4338ca", "#22d3ee"] },
  custom:   { ar: "ثيمي الخاص",        en: "My Custom Theme",  swatch: ["#3b82f6", "#22d3ee"] },
};

export const ICON_STYLE_LABELS: Record<IconStyle, { ar: string; en: string }> = {
  regular: { ar: "عادي",   en: "Regular" },
  thin:    { ar: "رفيع",   en: "Thin" },
  bold:    { ar: "عريض",   en: "Bold" },
  rounded: { ar: "دائري",  en: "Rounded" },
  sharp:   { ar: "حاد",    en: "Sharp" },
};

type ThemeTokens = Record<string, string>;

const DEFAULT_LIGHT_TOKENS: ThemeTokens = {
  "--background": "210 40% 98%", "--foreground": "222 47% 11%", "--card": "0 0% 100%", "--card-foreground": "222 47% 11%",
  "--popover": "0 0% 100%", "--popover-foreground": "222 47% 11%", "--primary": "217 91% 58%", "--primary-foreground": "0 0% 100%",
  "--secondary": "214 32% 91%", "--secondary-foreground": "222 47% 11%", "--muted": "214 32% 95%", "--muted-foreground": "215 20% 45%",
  "--accent": "189 94% 50%", "--accent-foreground": "222 47% 11%", "--border": "214 32% 88%", "--input": "214 32% 88%", "--ring": "217 91% 58%",
  "--sidebar-background": "222 47% 11%", "--sidebar-foreground": "210 40% 96%", "--sidebar-primary": "217 91% 60%", "--sidebar-primary-foreground": "0 0% 100%",
  "--sidebar-accent": "222 39% 18%", "--sidebar-accent-foreground": "210 40% 96%", "--sidebar-border": "222 30% 22%", "--sidebar-ring": "189 94% 50%",
  "--gradient-primary": "linear-gradient(135deg, hsl(222 47% 11%), hsl(217 91% 45%))", "--gradient-accent": "linear-gradient(135deg, hsl(217 91% 60%), hsl(189 94% 50%))", "--gradient-hero": "linear-gradient(160deg, hsl(222 47% 7%), hsl(222 55% 14%), hsl(217 70% 24%))",
};

const DEFAULT_DARK_TOKENS: ThemeTokens = {
  "--background": "222 47% 6%", "--foreground": "210 40% 96%", "--card": "222 44% 9%", "--card-foreground": "210 40% 96%",
  "--popover": "222 44% 9%", "--popover-foreground": "210 40% 96%", "--primary": "217 91% 60%", "--primary-foreground": "222 47% 8%", "--secondary": "222 30% 16%",
  "--secondary-foreground": "210 40% 96%", "--muted": "222 30% 14%", "--muted-foreground": "215 20% 65%", "--accent": "189 94% 55%", "--accent-foreground": "222 47% 8%",
  "--border": "222 30% 18%", "--input": "222 30% 18%", "--ring": "189 94% 55%", "--sidebar-background": "222 50% 5%",
  "--sidebar-accent": "222 35% 14%", "--sidebar-border": "222 30% 16%",
};

const PALETTE_TOKENS: Record<ThemePalette, { light: ThemeTokens; dark: ThemeTokens }> = {
  default: { light: {}, dark: {} },
  midnight: { light: { "--background": "240 30% 96%", "--card": "240 30% 99%", "--muted": "240 25% 92%", "--border": "240 20% 86%", "--input": "240 20% 86%", "--primary": "240 60% 22%", "--secondary": "244 60% 94%", "--accent": "244 84% 60%", "--ring": "244 84% 60%", "--sidebar-background": "240 60% 14%", "--sidebar-accent": "244 60% 24%", "--gradient-primary": "linear-gradient(135deg, hsl(240 60% 16%), hsl(244 70% 32%))", "--gradient-accent": "linear-gradient(135deg, hsl(244 84% 55%), hsl(260 84% 65%))", "--gradient-hero": "linear-gradient(160deg, hsl(240 60% 8%), hsl(244 60% 20%), hsl(260 50% 30%))" }, dark: { "--background": "240 40% 7%", "--card": "240 40% 11%", "--muted": "240 30% 16%", "--border": "240 28% 22%", "--input": "240 28% 22%", "--primary": "244 84% 65%", "--accent": "260 84% 70%", "--sidebar-background": "240 50% 10%", "--sidebar-accent": "244 50% 20%" } },
  emerald: { light: { "--background": "150 25% 96%", "--card": "150 30% 99%", "--muted": "150 20% 92%", "--border": "150 18% 85%", "--input": "150 18% 85%", "--primary": "160 80% 18%", "--secondary": "160 30% 92%", "--accent": "42 65% 48%", "--ring": "42 65% 48%", "--sidebar-background": "160 80% 14%", "--sidebar-foreground": "42 60% 88%", "--sidebar-accent": "160 70% 24%", "--gradient-primary": "linear-gradient(135deg, hsl(160 80% 16%), hsl(160 70% 30%))", "--gradient-accent": "linear-gradient(135deg, hsl(42 70% 50%), hsl(42 80% 65%))", "--gradient-hero": "linear-gradient(160deg, hsl(160 80% 10%), hsl(160 60% 22%), hsl(42 50% 35%))" }, dark: { "--background": "160 40% 7%", "--card": "160 40% 11%", "--muted": "160 30% 16%", "--border": "160 25% 22%", "--input": "160 25% 22%", "--primary": "42 65% 56%", "--accent": "160 60% 50%", "--sidebar-background": "160 60% 10%", "--sidebar-accent": "160 50% 20%" } },
  rose: { light: { "--background": "320 30% 97%", "--card": "320 30% 99%", "--muted": "320 20% 93%", "--border": "320 18% 87%", "--input": "320 18% 87%", "--primary": "280 35% 50%", "--secondary": "340 50% 94%", "--accent": "340 75% 62%", "--ring": "340 75% 62%", "--sidebar-background": "280 35% 35%", "--sidebar-accent": "320 50% 45%", "--gradient-primary": "linear-gradient(135deg, hsl(280 35% 42%), hsl(320 50% 60%))", "--gradient-accent": "linear-gradient(135deg, hsl(340 70% 70%), hsl(280 50% 70%))", "--gradient-hero": "linear-gradient(160deg, hsl(280 35% 30%), hsl(320 40% 50%), hsl(340 50% 65%))" }, dark: { "--background": "300 30% 9%", "--card": "300 30% 13%", "--muted": "300 20% 18%", "--border": "300 20% 24%", "--input": "300 20% 24%", "--primary": "340 75% 70%", "--accent": "280 60% 72%", "--sidebar-background": "300 35% 14%", "--sidebar-accent": "320 40% 24%" } },
  slate: { light: { "--background": "215 16% 96%", "--card": "215 20% 99%", "--muted": "215 15% 92%", "--border": "215 15% 85%", "--input": "215 15% 85%", "--primary": "220 25% 28%", "--secondary": "215 20% 92%", "--accent": "215 40% 50%", "--ring": "215 40% 50%", "--sidebar-background": "220 25% 20%", "--sidebar-accent": "215 25% 30%", "--gradient-primary": "linear-gradient(135deg, hsl(220 25% 22%), hsl(215 30% 38%))", "--gradient-accent": "linear-gradient(135deg, hsl(215 40% 48%), hsl(215 40% 65%))", "--gradient-hero": "linear-gradient(160deg, hsl(220 25% 18%), hsl(215 28% 32%), hsl(215 25% 48%))" }, dark: { "--background": "220 20% 9%", "--card": "220 20% 13%", "--muted": "220 15% 18%", "--border": "220 15% 24%", "--input": "220 15% 24%", "--primary": "215 50% 65%", "--accent": "215 55% 72%", "--sidebar-background": "220 25% 12%", "--sidebar-accent": "215 25% 22%" } },
  sunset: { light: { "--background": "30 35% 97%", "--card": "30 40% 99%", "--muted": "30 25% 93%", "--border": "30 20% 87%", "--input": "30 20% 87%", "--primary": "16 85% 50%", "--secondary": "30 60% 93%", "--accent": "330 75% 58%", "--ring": "16 85% 50%", "--sidebar-background": "16 70% 35%", "--sidebar-accent": "16 70% 45%", "--gradient-primary": "linear-gradient(135deg, hsl(16 90% 50%), hsl(330 80% 60%))", "--gradient-accent": "linear-gradient(135deg, hsl(36 95% 55%), hsl(16 90% 60%))", "--gradient-hero": "linear-gradient(160deg, hsl(16 80% 35%), hsl(330 70% 50%), hsl(260 60% 50%))" }, dark: { "--background": "16 25% 9%", "--card": "16 25% 13%", "--muted": "16 20% 18%", "--border": "16 20% 24%", "--input": "16 20% 24%", "--primary": "16 85% 60%", "--accent": "330 75% 65%", "--sidebar-background": "16 40% 14%", "--sidebar-accent": "16 40% 24%" } },
  ocean: { light: { "--background": "200 30% 96%", "--card": "200 35% 99%", "--muted": "200 22% 92%", "--border": "200 18% 85%", "--input": "200 18% 85%", "--primary": "210 70% 20%", "--secondary": "188 40% 92%", "--accent": "188 60% 42%", "--ring": "188 60% 42%", "--sidebar-background": "210 70% 14%", "--sidebar-accent": "210 60% 24%", "--gradient-primary": "linear-gradient(135deg, hsl(210 70% 16%), hsl(210 55% 30%))", "--gradient-accent": "linear-gradient(135deg, hsl(188 56% 42%), hsl(180 50% 55%))", "--gradient-hero": "linear-gradient(160deg, hsl(210 70% 10%), hsl(210 55% 22%), hsl(188 50% 35%))" }, dark: { "--background": "210 40% 8%", "--card": "210 40% 12%", "--muted": "210 30% 16%", "--border": "210 28% 22%", "--input": "210 28% 22%", "--primary": "188 60% 52%", "--accent": "180 60% 60%", "--sidebar-background": "210 50% 10%", "--sidebar-accent": "210 45% 20%" } },
  noir: { light: { "--background": "0 0% 96%", "--card": "0 0% 100%", "--muted": "0 0% 92%", "--border": "0 0% 85%", "--input": "0 0% 85%", "--primary": "0 0% 8%", "--primary-foreground": "42 55% 70%", "--secondary": "42 30% 92%", "--accent": "42 60% 50%", "--ring": "42 60% 50%", "--sidebar-background": "0 0% 6%", "--sidebar-foreground": "42 55% 80%", "--sidebar-accent": "0 0% 14%", "--gradient-primary": "linear-gradient(135deg, hsl(0 0% 6%), hsl(0 0% 18%))", "--gradient-accent": "linear-gradient(135deg, hsl(42 55% 50%), hsl(42 70% 65%))", "--gradient-hero": "linear-gradient(160deg, hsl(0 0% 5%), hsl(0 0% 14%), hsl(42 40% 30%))" }, dark: { "--background": "0 0% 5%", "--card": "0 0% 9%", "--muted": "0 0% 13%", "--border": "0 0% 18%", "--input": "0 0% 18%", "--primary": "42 65% 62%", "--primary-foreground": "0 0% 8%", "--accent": "42 70% 70%", "--sidebar-background": "0 0% 4%", "--sidebar-accent": "42 40% 18%" } },
  aurora: { light: { "--background": "235 30% 97%", "--card": "235 30% 99%", "--muted": "235 20% 93%", "--border": "235 18% 87%", "--input": "235 18% 87%", "--primary": "243 70% 40%", "--primary-foreground": "0 0% 100%", "--secondary": "190 40% 93%", "--accent": "190 85% 45%", "--accent-foreground": "0 0% 100%", "--ring": "190 85% 45%", "--sidebar-background": "243 70% 16%", "--sidebar-foreground": "0 0% 96%", "--sidebar-accent": "262 70% 32%", "--gradient-primary": "linear-gradient(135deg, hsl(243 70% 30%), hsl(270 70% 50%))", "--gradient-accent": "linear-gradient(135deg, hsl(190 85% 45%), hsl(160 68% 50%))", "--gradient-hero": "linear-gradient(160deg, hsl(243 70% 12%), hsl(262 65% 26%), hsl(190 75% 40%))" }, dark: { "--background": "245 45% 7%", "--card": "245 40% 11%", "--muted": "245 30% 16%", "--border": "245 28% 22%", "--input": "245 28% 22%", "--primary": "190 85% 55%", "--accent": "262 75% 68%", "--sidebar-background": "245 50% 9%", "--sidebar-accent": "245 40% 20%" } },
  custom: { light: {}, dark: {} },
};

const hexToHsl = (hex: string, fallback: string) => {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return fallback;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const getCustomTokens = (theme: ThemeMode, colors: CustomThemeColors): ThemeTokens => {
  const primary = hexToHsl(colors.primary, DEFAULT_LIGHT_TOKENS["--primary"]);
  const accent = hexToHsl(colors.accent, DEFAULT_LIGHT_TOKENS["--accent"]);
  const background = hexToHsl(colors.background, DEFAULT_LIGHT_TOKENS["--background"]);
  const card = hexToHsl(colors.card, DEFAULT_LIGHT_TOKENS["--card"]);
  if (theme === "dark") {
    const hue = primary.split(" ")[0];
    return { "--background": `${hue} 32% 7%`, "--card": `${hue} 28% 11%`, "--muted": `${hue} 20% 16%`, "--border": `${hue} 18% 22%`, "--input": `${hue} 18% 22%`, "--primary": accent, "--accent": primary, "--ring": accent, "--sidebar-background": `${hue} 38% 9%`, "--sidebar-accent": `${hue} 28% 18%`, "--gradient-primary": `linear-gradient(135deg, hsl(${primary}), hsl(${accent}))`, "--gradient-accent": `linear-gradient(135deg, hsl(${accent}), hsl(${primary}))`, "--gradient-hero": `linear-gradient(160deg, hsl(${hue} 42% 7%), hsl(${primary}), hsl(${accent}))` };
  }
  return { "--background": background, "--card": card, "--muted": background, "--border": "214 32% 88%", "--input": "214 32% 88%", "--primary": primary, "--accent": accent, "--ring": accent, "--sidebar-background": primary, "--sidebar-accent": accent, "--gradient-primary": `linear-gradient(135deg, hsl(${primary}), hsl(${accent}))`, "--gradient-accent": `linear-gradient(135deg, hsl(${accent}), hsl(${primary}))`, "--gradient-hero": `linear-gradient(160deg, hsl(${primary}), hsl(${accent}))` };
};

const applyThemeTokens = (theme: ThemeMode, palette: ThemePalette, customTheme: CustomThemeColors) => {
  const root = document.documentElement;
  const tokens = { ...DEFAULT_LIGHT_TOKENS, ...(theme === "dark" ? DEFAULT_DARK_TOKENS : {}), ...PALETTE_TOKENS[palette].light, ...(theme === "dark" ? PALETTE_TOKENS[palette].dark : {}), ...(palette === "custom" ? getCustomTokens(theme, customTheme) : {}) };
  Object.entries(tokens).forEach(([key, value]) => root.style.setProperty(key, value));
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem("akg-theme") as ThemeMode) || "light"; }
    catch { return "light"; }
  });
  const [palette, setPaletteState] = useState<ThemePalette>(() => {
    try {
      const v = localStorage.getItem("akg-palette") as ThemePalette;
      return PALETTES.includes(v) ? v : "default";
    } catch { return "default"; }
  });
  const [iconStyle, setIconStyleState] = useState<IconStyle>(() => {
    try {
      const v = localStorage.getItem("akg-icons") as IconStyle;
      return ICON_STYLES.includes(v) ? v : "regular";
    } catch { return "regular"; }
  });
  const [customTheme, setCustomThemeState] = useState<CustomThemeColors>(() => {
    try { return { ...DEFAULT_CUSTOM_THEME, ...JSON.parse(localStorage.getItem("akg-custom-theme") || "{}") }; }
    catch { return DEFAULT_CUSTOM_THEME; }
  });
  const [animatedBg, setAnimatedBgState] = useState<boolean>(() => {
    try { return localStorage.getItem("akg-animated-bg") === "true"; }
    catch { return false; }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark"); else root.classList.remove("dark");
    applyThemeTokens(theme, palette, customTheme);
    localStorage.setItem("akg-theme", theme);
  }, [theme, palette, customTheme]);

  useEffect(() => {
    const root = document.documentElement;
    PALETTES.forEach((p) => root.classList.remove(`palette-${p}`));
    root.classList.add(`palette-${palette}`);
    applyThemeTokens(theme, palette, customTheme);
    localStorage.setItem("akg-palette", palette);
  }, [theme, palette, customTheme]);

  useEffect(() => {
    const root = document.documentElement;
    ICON_STYLES.forEach((s) => root.classList.remove(`icons-${s}`));
    root.classList.add(`icons-${iconStyle}`);
    localStorage.setItem("akg-icons", iconStyle);
  }, [iconStyle]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("animated-bg", animatedBg);
    localStorage.setItem("akg-animated-bg", String(animatedBg));
  }, [animatedBg]);

  const setCustomTheme = (colors: CustomThemeColors) => {
    setCustomThemeState(colors);
    localStorage.setItem("akg-custom-theme", JSON.stringify(colors));
    setPaletteState("custom");
  };

  return (
    <ThemeContext.Provider value={{
      theme, palette, iconStyle, customTheme, animatedBg,
      toggleTheme: () => setTheme((p) => (p === "light" ? "dark" : "light")),
      setPalette: setPaletteState,
      setIconStyle: setIconStyleState,
      setCustomTheme,
      setAnimatedBg: setAnimatedBgState,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
